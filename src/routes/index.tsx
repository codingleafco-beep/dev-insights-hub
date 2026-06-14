import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Activity, BellRing, Flag, PlaySquare, Search, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LoveHog — local-first product analytics" },
      {
        name: "description",
        content:
          "PostHog-style analytics, feature flags, session replay, ntfy alerts and SearXNG — all running on your machine. No auth, no cloud.",
      },
      { property: "og:title", content: "LoveHog — local-first product analytics" },
      {
        property: "og:description",
        content:
          "Always-on analytics server + clean dashboard. Capture events, replay sessions, ship feature flags, fire ntfy alerts.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Activity,
    title: "Event capture",
    body: "POST to /capture. SQLite under the hood. Live dashboard with top events, hourly series, unique users.",
  },
  {
    icon: PlaySquare,
    title: "Session replay",
    body: "Drop in rrweb. Append events to /replay/:sessionId and play them back in the dashboard.",
  },
  {
    icon: Flag,
    title: "Feature flags",
    body: "Boolean + multi-variant flags with consistent hashing. Evaluate per distinct_id from your client.",
  },
  {
    icon: BellRing,
    title: "ntfy alerts",
    body: "Wire up rules on the server. Match by event name + properties. Pushes hit your phone instantly.",
  },
  {
    icon: Search,
    title: "Web search",
    body: "SearXNG proxied through the server so your app can search the web without leaking keys.",
  },
  {
    icon: Zap,
    title: "Built for dev",
    body: "No auth. No accounts. Spin it up next to your app and forget it until you need the UI.",
  },
];

function Landing() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            <span className="mono text-sm font-bold">LoveHog</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <a
              href="https://posthog.com"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              Inspired by PostHog
            </a>
            <Link
              to="/dashboard"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Open dashboard
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border bg-grid">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="mono">v0.1 · self-hosted · zero auth</span>
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Product analytics{" "}
            <span className="text-primary text-glow">for the localhost era.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            A PostHog-shaped server you keep running next to your app, plus a clean
            dashboard you open only when you want to look. Events, replays, flags,
            push alerts and web search — all yours.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground glow-primary transition-transform hover:-translate-y-0.5"
            >
              Open dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/dashboard/install"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Install snippet
            </Link>
          </div>

          <div className="mt-12 max-w-2xl rounded-lg border border-border bg-card/80 p-4 backdrop-blur">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-destructive/70" />
              <span className="h-2 w-2 rounded-full bg-chart-4/70" />
              <span className="h-2 w-2 rounded-full bg-primary/70" />
              <span className="mono ml-2">~/your-app</span>
            </div>
            <pre className="mono overflow-x-auto text-sm leading-relaxed text-foreground">
{`$ cd server && npm install && npm run dev
🦔 LoveHog server listening on http://localhost:4318

$ docker compose up -d   # ntfy + searxng
$ open http://localhost:5173/dashboard`}
            </pre>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mono text-sm uppercase tracking-widest text-muted-foreground">
          // what's inside
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <span className="mono">LoveHog · MIT · run locally</span>
          <Link to="/dashboard" className="hover:text-foreground">
            dashboard →
          </Link>
        </div>
      </footer>
    </div>
  );
}
