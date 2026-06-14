import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { db, getSetting, setSetting } from "./db.js";
import { dispatchNotifications } from "./notify.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = Number(process.env.PORT ?? 4318);

app.get("/health", (_req, res) => res.json({ ok: true, service: "lovehog" }));

/* ───────── Capture ───────── */
app.post("/capture", async (req, res) => {
  const body = req.body ?? {};
  const events = Array.isArray(body.batch) ? body.batch : [body];
  const stmt = db.prepare(
    `INSERT INTO events(id, ts, event, distinct_id, session_id, url, referrer, user_agent, properties)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const upsertSession = db.prepare(
    `INSERT INTO sessions(id, distinct_id, started_at, last_seen_at, pageviews, events, user_agent, entry_url)
     VALUES(?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       last_seen_at = excluded.last_seen_at,
       events = sessions.events + 1,
       pageviews = sessions.pageviews + excluded.pageviews`,
  );

  const ua = req.headers["user-agent"] ?? "";
  const inserted: typeof events = [];

  const tx = db.transaction((batch: any[]) => {
    for (const e of batch) {
      const id = nanoid();
      const ts = e.timestamp ? Number(e.timestamp) : Date.now();
      const ev = String(e.event ?? "$unknown");
      const sid = e.session_id ?? null;
      const url = e.url ?? e.properties?.$current_url ?? null;
      stmt.run(
        id,
        ts,
        ev,
        e.distinct_id ?? null,
        sid,
        url,
        e.referrer ?? null,
        ua,
        JSON.stringify(e.properties ?? {}),
      );
      if (sid) {
        upsertSession.run(
          sid,
          e.distinct_id ?? null,
          ts,
          ts,
          ev === "$pageview" ? 1 : 0,
          ua,
          url,
        );
      }
      inserted.push({ ...e, id, ts });
    }
  });
  tx(events);

  // Fire-and-forget notifications
  inserted.forEach((e) =>
    dispatchNotifications({
      event: e.event,
      properties: e.properties ?? {},
      distinct_id: e.distinct_id,
      url: e.url ?? e.properties?.$current_url,
    }).catch(() => {}),
  );

  res.json({ ok: true, count: inserted.length });
});

/* ───────── Events / Stats ───────── */
app.get("/events", (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const event = req.query.event as string | undefined;
  const rows = event
    ? db
        .prepare("SELECT * FROM events WHERE event = ? ORDER BY ts DESC LIMIT ?")
        .all(event, limit)
    : db.prepare("SELECT * FROM events ORDER BY ts DESC LIMIT ?").all(limit);
  res.json(rows);
});

app.get("/stats/overview", (_req, res) => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const total = (db.prepare("SELECT COUNT(*) c FROM events").get() as any).c;
  const last24 = (
    db.prepare("SELECT COUNT(*) c FROM events WHERE ts > ?").get(now - day) as any
  ).c;
  const uniqueUsers = (
    db.prepare("SELECT COUNT(DISTINCT distinct_id) c FROM events WHERE distinct_id IS NOT NULL").get() as any
  ).c;
  const sessions = (db.prepare("SELECT COUNT(*) c FROM sessions").get() as any).c;
  const topEvents = db
    .prepare("SELECT event, COUNT(*) c FROM events GROUP BY event ORDER BY c DESC LIMIT 10")
    .all();

  // hourly buckets last 24h
  const series = db
    .prepare(
      `SELECT (ts / 3600000) * 3600000 AS bucket, COUNT(*) c
       FROM events WHERE ts > ? GROUP BY bucket ORDER BY bucket ASC`,
    )
    .all(now - day);

  res.json({ total, last24, uniqueUsers, sessions, topEvents, series });
});

/* ───────── Sessions ───────── */
app.get("/sessions", (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const rows = db
    .prepare("SELECT * FROM sessions ORDER BY last_seen_at DESC LIMIT ?")
    .all(limit);
  res.json(rows);
});

app.get("/sessions/:id", (req, res) => {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
  const events = db
    .prepare("SELECT * FROM events WHERE session_id = ? ORDER BY ts ASC")
    .all(req.params.id);
  res.json({ session, events });
});

/* ───────── Feature Flags ───────── */
app.get("/flags", (_req, res) => {
  res.json(db.prepare("SELECT * FROM flags ORDER BY updated_at DESC").all());
});

app.post("/flags", (req, res) => {
  const { key, name, description, enabled = true, rollout = 100, variants } = req.body ?? {};
  if (!key) return res.status(400).json({ error: "key required" });
  const now = Date.now();
  db.prepare(
    `INSERT INTO flags(key, name, description, enabled, rollout, variants, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       name=excluded.name, description=excluded.description,
       enabled=excluded.enabled, rollout=excluded.rollout,
       variants=excluded.variants, updated_at=excluded.updated_at`,
  ).run(
    key,
    name ?? key,
    description ?? "",
    enabled ? 1 : 0,
    rollout,
    variants ? JSON.stringify(variants) : null,
    now,
    now,
  );
  res.json({ ok: true });
});

app.delete("/flags/:key", (req, res) => {
  db.prepare("DELETE FROM flags WHERE key = ?").run(req.params.key);
  res.json({ ok: true });
});

// Evaluate flags for a distinct_id (simple consistent hashing)
app.get("/flags/evaluate", (req, res) => {
  const distinctId = String(req.query.distinct_id ?? "anon");
  const flags = db.prepare("SELECT * FROM flags WHERE enabled = 1").all() as any[];
  const result: Record<string, boolean | string> = {};
  for (const f of flags) {
    const hash = Array.from(distinctId + f.key).reduce(
      (a, c) => (a * 31 + c.charCodeAt(0)) >>> 0,
      0,
    );
    const bucket = hash % 100;
    if (bucket < f.rollout) {
      if (f.variants) {
        const variants = JSON.parse(f.variants) as { key: string; weight: number }[];
        let acc = 0;
        const pick = hash % 100;
        let chosen: string | boolean = true;
        for (const v of variants) {
          acc += v.weight;
          if (pick < acc) {
            chosen = v.key;
            break;
          }
        }
        result[f.key] = chosen;
      } else {
        result[f.key] = true;
      }
    } else {
      result[f.key] = false;
    }
  }
  res.json(result);
});

/* ───────── Session Replay ───────── */
app.post("/replay/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const { events, distinct_id } = req.body ?? {};
  if (!Array.isArray(events) || !events.length)
    return res.status(400).json({ error: "events required" });

  const now = Date.now();
  let rec = db
    .prepare("SELECT * FROM recordings WHERE session_id = ?")
    .get(sessionId) as any;
  if (!rec) {
    const id = nanoid();
    db.prepare(
      "INSERT INTO recordings(id, session_id, distinct_id, ts, duration, chunks) VALUES(?,?,?,?,0,0)",
    ).run(id, sessionId, distinct_id ?? null, now);
    rec = { id, ts: now };
  }
  const insert = db.prepare(
    "INSERT INTO recording_chunks(recording_id, ts, payload) VALUES(?, ?, ?)",
  );
  const tx = db.transaction(() => {
    for (const e of events) insert.run(rec.id, e.timestamp ?? now, JSON.stringify(e));
    db.prepare(
      "UPDATE recordings SET chunks = chunks + ?, duration = ? - ts WHERE id = ?",
    ).run(events.length, now, rec.id);
  });
  tx();
  res.json({ ok: true, recording_id: rec.id });
});

app.get("/replay", (_req, res) => {
  res.json(
    db.prepare("SELECT * FROM recordings ORDER BY ts DESC LIMIT 100").all(),
  );
});

app.get("/replay/:id", (req, res) => {
  const rec = db.prepare("SELECT * FROM recordings WHERE id = ?").get(req.params.id);
  const chunks = db
    .prepare("SELECT payload FROM recording_chunks WHERE recording_id = ? ORDER BY ts ASC")
    .all(req.params.id) as { payload: string }[];
  res.json({ recording: rec, events: chunks.map((c) => JSON.parse(c.payload)) });
});

/* ───────── Settings (ntfy + searxng URLs) ───────── */
app.get("/settings", (_req, res) => {
  res.json({
    ntfy_url: getSetting("ntfy_url") ?? "",
    ntfy_topic: getSetting("ntfy_topic") ?? "lovehog",
    searxng_url: getSetting("searxng_url") ?? "",
  });
});

app.post("/settings", (req, res) => {
  for (const [k, v] of Object.entries(req.body ?? {})) {
    if (typeof v === "string") setSetting(k, v);
  }
  res.json({ ok: true });
});

/* ───────── Notification rules ───────── */
app.get("/notifications/rules", (_req, res) => {
  res.json(db.prepare("SELECT * FROM notification_rules ORDER BY created_at DESC").all());
});

app.post("/notifications/rules", (req, res) => {
  const { name, event, condition, topic, priority = 3, enabled = true } = req.body ?? {};
  if (!name || !event) return res.status(400).json({ error: "name and event required" });
  const id = nanoid();
  db.prepare(
    `INSERT INTO notification_rules(id, name, event, condition, topic, priority, enabled, created_at)
     VALUES(?,?,?,?,?,?,?,?)`,
  ).run(id, name, event, condition ?? null, topic ?? null, priority, enabled ? 1 : 0, Date.now());
  res.json({ ok: true, id });
});

app.delete("/notifications/rules/:id", (req, res) => {
  db.prepare("DELETE FROM notification_rules WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/notifications/test", async (req, res) => {
  const base = getSetting("ntfy_url");
  if (!base) return res.status(400).json({ error: "ntfy_url not configured" });
  const topic = (req.body?.topic as string) || getSetting("ntfy_topic") || "lovehog";
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/${topic}`, {
      method: "POST",
      headers: { Title: "LoveHog test", Priority: "3", Tags: "rocket" },
      body: "Test notification from LoveHog dashboard",
    });
    res.json({ ok: r.ok, status: r.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ───────── SearXNG proxy ───────── */
app.get("/search", async (req, res) => {
  const base = getSetting("searxng_url");
  if (!base) return res.status(400).json({ error: "searxng_url not configured" });
  const q = String(req.query.q ?? "");
  if (!q) return res.status(400).json({ error: "q required" });
  try {
    const url = `${base.replace(/\/$/, "")}/search?q=${encodeURIComponent(q)}&format=json`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return res.status(r.status).json({ error: `searxng ${r.status}` });
    const data = await r.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🦔 LoveHog server listening on http://localhost:${PORT}`);
});
