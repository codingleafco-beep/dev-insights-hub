import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import {
  db,
  getSetting,
  setSetting,
  ensureDefaultProject,
  getProjectByApiKey,
  getProjectById,
} from "./db.js";
import { dispatchNotifications } from "./notify.js";

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true,
    exposedHeaders: ["x-project-id"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "x-project-id",
    ],
  }),
);
app.use(express.json({ limit: "10mb" }));

const PORT = Number(process.env.PORT ?? 4318);

// Boot: ensure there is always at least one project.
const defaultProject = ensureDefaultProject();
console.log(
  `🦔 default project "${defaultProject.name}" (${defaultProject.id}) key=${defaultProject.api_key}`,
);

/* ───────── Project resolution middleware ─────────
   - SDK requests authenticate with `x-api-key` (or ?api_key, or body.api_key).
   - Dashboard requests pass `x-project-id` (or ?project_id) — no auth required,
     this is a local devtool.
*/
function pickKey(req: Request): string | undefined {
  return (
    (req.header("x-api-key") as string | undefined) ||
    (req.query.api_key as string | undefined) ||
    (req.body && typeof req.body === "object" ? req.body.api_key : undefined)
  );
}
function pickProjectId(req: Request): string | undefined {
  return (
    (req.header("x-project-id") as string | undefined) ||
    (req.query.project_id as string | undefined)
  );
}

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = pickKey(req);
  if (!key) return res.status(401).json({ error: "x-api-key required" });
  const project = getProjectByApiKey(key);
  if (!project) return res.status(401).json({ error: "invalid api key" });
  (req as any).project = project;
  next();
}

function requireProject(req: Request, res: Response, next: NextFunction) {
  // Try api_key first (allows SDK to read flags etc), then dashboard project_id.
  const key = pickKey(req);
  if (key) {
    const p = getProjectByApiKey(key);
    if (!p) return res.status(401).json({ error: "invalid api key" });
    (req as any).project = p;
    return next();
  }
  const pid = pickProjectId(req);
  if (!pid) {
    // Fall back to default project so the dashboard works out of the box.
    (req as any).project = defaultProject;
    return next();
  }
  const p = getProjectById(pid);
  if (!p) return res.status(404).json({ error: "unknown project" });
  (req as any).project = p;
  next();
}

const projectId = (req: Request) => (req as any).project.id as string;

app.get("/health", (_req, res) => res.json({ ok: true, service: "lovehog" }));

/* ───────── Projects CRUD ───────── */
app.get("/projects", (_req, res) => {
  res.json(db.prepare("SELECT * FROM projects ORDER BY created_at ASC").all());
});

app.post("/projects", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const id = nanoid(12);
  const api_key = `lh_${nanoid(28)}`;
  db.prepare(
    "INSERT INTO projects(id, name, api_key, created_at) VALUES(?,?,?,?)",
  ).run(id, name, api_key, Date.now());
  res.json({ id, name, api_key });
});

app.post("/projects/:id/rotate", (req, res) => {
  const api_key = `lh_${nanoid(28)}`;
  const r = db
    .prepare("UPDATE projects SET api_key = ? WHERE id = ?")
    .run(api_key, req.params.id);
  if (!r.changes) return res.status(404).json({ error: "not found" });
  res.json({ id: req.params.id, api_key });
});

app.delete("/projects/:id", (req, res) => {
  const remaining = (db.prepare("SELECT COUNT(*) c FROM projects").get() as any)
    .c;
  if (remaining <= 1)
    return res.status(400).json({ error: "cannot delete last project" });
  const id = req.params.id;
  const tx = db.transaction(() => {
    for (const t of [
      "events",
      "sessions",
      "recordings",
      "notification_rules",
      "flags",
    ]) {
      db.prepare(`DELETE FROM ${t} WHERE project_id = ?`).run(id);
    }
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  });
  tx();
  res.json({ ok: true });
});

/* ───────── Capture ───────── */
app.post("/capture", requireApiKey, async (req, res) => {
  const pid = projectId(req);
  const body = req.body ?? {};
  const events = Array.isArray(body.batch) ? body.batch : [body];
  const stmt = db.prepare(
    `INSERT INTO events(id, project_id, ts, event, distinct_id, session_id, url, referrer, user_agent, properties)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const upsertSession = db.prepare(
    `INSERT INTO sessions(id, project_id, distinct_id, started_at, last_seen_at, pageviews, events, user_agent, entry_url)
     VALUES(?, ?, ?, ?, ?, ?, 1, ?, ?)
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
        pid,
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
          pid,
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

  inserted.forEach((e) =>
    dispatchNotifications(pid, {
      event: e.event,
      properties: e.properties ?? {},
      distinct_id: e.distinct_id,
      url: e.url ?? e.properties?.$current_url,
    }).catch(() => {}),
  );

  res.json({ ok: true, count: inserted.length });
});

/* ───────── Events / Stats ───────── */
app.get("/events", requireProject, (req, res) => {
  const pid = projectId(req);
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const event = req.query.event as string | undefined;
  const rows = event
    ? db
        .prepare(
          "SELECT * FROM events WHERE project_id = ? AND event = ? ORDER BY ts DESC LIMIT ?",
        )
        .all(pid, event, limit)
    : db
        .prepare(
          "SELECT * FROM events WHERE project_id = ? ORDER BY ts DESC LIMIT ?",
        )
        .all(pid, limit);
  res.json(rows);
});

app.get("/stats/overview", requireProject, (req, res) => {
  const pid = projectId(req);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const total = (
    db.prepare("SELECT COUNT(*) c FROM events WHERE project_id = ?").get(pid) as any
  ).c;
  const last24 = (
    db
      .prepare("SELECT COUNT(*) c FROM events WHERE project_id = ? AND ts > ?")
      .get(pid, now - day) as any
  ).c;
  const uniqueUsers = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT distinct_id) c FROM events WHERE project_id = ? AND distinct_id IS NOT NULL",
      )
      .get(pid) as any
  ).c;
  const sessions = (
    db.prepare("SELECT COUNT(*) c FROM sessions WHERE project_id = ?").get(pid) as any
  ).c;
  const topEvents = db
    .prepare(
      "SELECT event, COUNT(*) c FROM events WHERE project_id = ? GROUP BY event ORDER BY c DESC LIMIT 10",
    )
    .all(pid);
  const series = db
    .prepare(
      `SELECT (ts / 3600000) * 3600000 AS bucket, COUNT(*) c
       FROM events WHERE project_id = ? AND ts > ? GROUP BY bucket ORDER BY bucket ASC`,
    )
    .all(pid, now - day);

  res.json({ total, last24, uniqueUsers, sessions, topEvents, series });
});

/* ───────── Sessions ───────── */
app.get("/sessions", requireProject, (req, res) => {
  const pid = projectId(req);
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const rows = db
    .prepare(
      "SELECT * FROM sessions WHERE project_id = ? ORDER BY last_seen_at DESC LIMIT ?",
    )
    .all(pid, limit);
  res.json(rows);
});

app.get("/sessions/:id", requireProject, (req, res) => {
  const pid = projectId(req);
  const session = db
    .prepare("SELECT * FROM sessions WHERE id = ? AND project_id = ?")
    .get(req.params.id, pid);
  const events = db
    .prepare(
      "SELECT * FROM events WHERE session_id = ? AND project_id = ? ORDER BY ts ASC",
    )
    .all(req.params.id, pid);
  res.json({ session, events });
});

/* ───────── Feature Flags ───────── */
app.get("/flags", requireProject, (req, res) => {
  const pid = projectId(req);
  res.json(
    db
      .prepare("SELECT * FROM flags WHERE project_id = ? ORDER BY updated_at DESC")
      .all(pid),
  );
});

app.post("/flags", requireProject, (req, res) => {
  const pid = projectId(req);
  const { key, name, description, enabled = true, rollout = 100, variants } =
    req.body ?? {};
  if (!key) return res.status(400).json({ error: "key required" });
  const now = Date.now();
  db.prepare(
    `INSERT INTO flags(project_id, key, name, description, enabled, rollout, variants, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, key) DO UPDATE SET
       name=excluded.name, description=excluded.description,
       enabled=excluded.enabled, rollout=excluded.rollout,
       variants=excluded.variants, updated_at=excluded.updated_at`,
  ).run(
    pid,
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

app.delete("/flags/:key", requireProject, (req, res) => {
  const pid = projectId(req);
  db.prepare("DELETE FROM flags WHERE project_id = ? AND key = ?").run(
    pid,
    req.params.key,
  );
  res.json({ ok: true });
});

// SDK uses x-api-key here; dashboard preview can use x-project-id.
app.get("/flags/evaluate", requireProject, (req, res) => {
  const pid = projectId(req);
  const distinctId = String(req.query.distinct_id ?? "anon");
  const flags = db
    .prepare("SELECT * FROM flags WHERE project_id = ? AND enabled = 1")
    .all(pid) as any[];
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
app.post("/replay/:sessionId", requireApiKey, (req, res) => {
  const pid = projectId(req);
  const { sessionId } = req.params;
  const { events, distinct_id } = req.body ?? {};
  if (!Array.isArray(events) || !events.length)
    return res.status(400).json({ error: "events required" });

  const now = Date.now();
  let rec = db
    .prepare("SELECT * FROM recordings WHERE session_id = ? AND project_id = ?")
    .get(sessionId, pid) as any;
  if (!rec) {
    const id = nanoid();
    db.prepare(
      "INSERT INTO recordings(id, project_id, session_id, distinct_id, ts, duration, chunks) VALUES(?,?,?,?,?,0,0)",
    ).run(id, pid, sessionId, distinct_id ?? null, now);
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

app.get("/replay", requireProject, (req, res) => {
  const pid = projectId(req);
  res.json(
    db
      .prepare(
        "SELECT * FROM recordings WHERE project_id = ? ORDER BY ts DESC LIMIT 100",
      )
      .all(pid),
  );
});

app.get("/replay/:id", requireProject, (req, res) => {
  const pid = projectId(req);
  const rec = db
    .prepare("SELECT * FROM recordings WHERE id = ? AND project_id = ?")
    .get(req.params.id, pid);
  const chunks = db
    .prepare(
      "SELECT payload FROM recording_chunks WHERE recording_id = ? ORDER BY ts ASC",
    )
    .all(req.params.id) as { payload: string }[];
  res.json({ recording: rec, events: chunks.map((c) => JSON.parse(c.payload)) });
});

/* ───────── Settings (global ntfy + searxng URLs) ───────── */
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

/* ───────── Notification rules (per-project) ───────── */
app.get("/notifications/rules", requireProject, (req, res) => {
  const pid = projectId(req);
  res.json(
    db
      .prepare(
        "SELECT * FROM notification_rules WHERE project_id = ? ORDER BY created_at DESC",
      )
      .all(pid),
  );
});

app.post("/notifications/rules", requireProject, (req, res) => {
  const pid = projectId(req);
  const { name, event, condition, topic, priority = 3, enabled = true } =
    req.body ?? {};
  if (!name || !event)
    return res.status(400).json({ error: "name and event required" });
  const id = nanoid();
  db.prepare(
    `INSERT INTO notification_rules(id, project_id, name, event, condition, topic, priority, enabled, created_at)
     VALUES(?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    pid,
    name,
    event,
    condition ?? null,
    topic ?? null,
    priority,
    enabled ? 1 : 0,
    Date.now(),
  );
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
