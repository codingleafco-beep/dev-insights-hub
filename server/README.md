# LoveHog Server

Always-on analytics ingest server. PostHog-style API, no auth, SQLite storage.

## Run

```bash
cd server
npm install        # or: bun install
npm run dev        # http://localhost:4318
```

Data is stored in `./data/lovehog.db`. Override with `LOVEHOG_DB=/path/to.db`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/capture` | Ingest event(s). Body: `{event, distinct_id, session_id, properties, url}` or `{batch: [...]}` |
| GET  | `/events` | Recent events |
| GET  | `/stats/overview` | Totals, top events, hourly series |
| GET  | `/sessions` | Recent sessions |
| GET  | `/sessions/:id` | Session + events |
| GET  | `/flags` · POST · DELETE | Feature flag CRUD |
| GET  | `/flags/evaluate?distinct_id=` | Evaluate flags for a user |
| POST | `/replay/:sessionId` | Append rrweb events |
| GET  | `/replay` · `/replay/:id` | List / fetch recordings |
| GET  | `/settings` · POST | ntfy & searxng URLs |
| GET  | `/notifications/rules` · POST · DELETE | Rules that fire ntfy pushes |
| POST | `/notifications/test` | Send a test push |
| GET  | `/search?q=` | Proxy to SearXNG |

## Tracking from your app

```js
fetch("http://localhost:4318/capture", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    event: "$pageview",
    distinct_id: "user_123",
    session_id: "sess_abc",
    url: location.href,
    properties: { path: location.pathname },
  }),
});
```

## Supporting services (ntfy + SearXNG)

From the repo root:

```bash
docker compose up -d
```

- ntfy → http://localhost:8081
- SearXNG → http://localhost:8888

Then open the dashboard **Settings** page and paste those URLs.
