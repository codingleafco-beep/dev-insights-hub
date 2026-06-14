import { db, getSetting } from "./db.js";

interface Rule {
  id: string;
  name: string;
  event: string;
  condition: string | null;
  topic: string | null;
  priority: number;
  enabled: number;
}

function matches(condition: string | null, props: Record<string, unknown>): boolean {
  if (!condition) return true;
  try {
    // Very small expression: key=value&key2=value2
    return condition.split("&").every((part) => {
      const [k, v] = part.split("=");
      if (!k) return true;
      return String(props[k.trim()] ?? "") === (v ?? "").trim();
    });
  } catch {
    return false;
  }
}

export async function dispatchNotifications(event: {
  event: string;
  properties: Record<string, unknown>;
  distinct_id?: string | null;
  url?: string | null;
}) {
  const base = getSetting("ntfy_url");
  if (!base) return;
  const defaultTopic = getSetting("ntfy_topic") ?? "lovehog";

  const rules = db
    .prepare("SELECT * FROM notification_rules WHERE enabled = 1 AND event = ?")
    .all(event.event) as Rule[];

  await Promise.all(
    rules
      .filter((r) => matches(r.condition, event.properties))
      .map(async (r) => {
        const topic = r.topic || defaultTopic;
        const url = `${base.replace(/\/$/, "")}/${topic}`;
        try {
          await fetch(url, {
            method: "POST",
            headers: {
              Title: `LoveHog: ${r.name}`,
              Priority: String(r.priority),
              Tags: "bell",
            },
            body: `${event.event} — ${event.distinct_id ?? "anon"}${event.url ? ` @ ${event.url}` : ""}`,
          });
        } catch (err) {
          console.error("ntfy dispatch failed", err);
        }
      }),
  );
}
