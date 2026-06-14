// Tiny fetch client for the LoveHog server.
// Configure base URL via VITE_LOVEHOG_URL (defaults to http://localhost:4318).

const BASE =
  (import.meta.env.VITE_LOVEHOG_URL as string | undefined) ??
  "http://localhost:4318";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  base: BASE,
  health: () => req<{ ok: boolean }>("/health"),
  overview: () =>
    req<{
      total: number;
      last24: number;
      uniqueUsers: number;
      sessions: number;
      topEvents: { event: string; c: number }[];
      series: { bucket: number; c: number }[];
    }>("/stats/overview"),
  events: (limit = 100, event?: string) =>
    req<any[]>(
      `/events?limit=${limit}${event ? `&event=${encodeURIComponent(event)}` : ""}`,
    ),
  sessions: () => req<any[]>("/sessions"),
  session: (id: string) => req<{ session: any; events: any[] }>(`/sessions/${id}`),
  flags: () => req<any[]>("/flags"),
  saveFlag: (f: any) =>
    req<{ ok: boolean }>("/flags", { method: "POST", body: JSON.stringify(f) }),
  deleteFlag: (key: string) =>
    req<{ ok: boolean }>(`/flags/${key}`, { method: "DELETE" }),
  replays: () => req<any[]>("/replay"),
  replay: (id: string) =>
    req<{ recording: any; events: any[] }>(`/replay/${id}`),
  settings: () =>
    req<{ ntfy_url: string; ntfy_topic: string; searxng_url: string }>(
      "/settings",
    ),
  saveSettings: (s: Record<string, string>) =>
    req<{ ok: boolean }>("/settings", { method: "POST", body: JSON.stringify(s) }),
  rules: () => req<any[]>("/notifications/rules"),
  createRule: (r: any) =>
    req<{ ok: boolean }>("/notifications/rules", {
      method: "POST",
      body: JSON.stringify(r),
    }),
  deleteRule: (id: string) =>
    req<{ ok: boolean }>(`/notifications/rules/${id}`, { method: "DELETE" }),
  testNotify: (topic?: string) =>
    req<{ ok: boolean }>("/notifications/test", {
      method: "POST",
      body: JSON.stringify({ topic }),
    }),
  search: (q: string) =>
    req<{ results: any[]; query: string }>(`/search?q=${encodeURIComponent(q)}`),
  capture: (e: any) =>
    req<{ ok: boolean }>("/capture", { method: "POST", body: JSON.stringify(e) }),
};
