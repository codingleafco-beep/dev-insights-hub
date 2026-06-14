import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/lovehog-api";
import { PageHeader } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/dashboard/install")({
  component: Install,
});

const snippet = (base: string) => `// Drop this in your app
const LH = "${base}";
const distinct_id = localStorage.getItem("lh_id") ||
  (localStorage.setItem("lh_id", crypto.randomUUID()), localStorage.getItem("lh_id"));
const session_id = sessionStorage.getItem("lh_sid") ||
  (sessionStorage.setItem("lh_sid", crypto.randomUUID()), sessionStorage.getItem("lh_sid"));

export function capture(event, properties = {}) {
  return fetch(\`\${LH}/capture\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event, distinct_id, session_id,
      url: location.href,
      properties: { path: location.pathname, ...properties },
    }),
  });
}

// Auto pageviews
capture("$pageview");
window.addEventListener("popstate", () => capture("$pageview"));`;

const flagSnippet = (base: string) => `// Evaluate flags
const flags = await fetch(\`${base}/flags/evaluate?distinct_id=\${distinct_id}\`)
  .then(r => r.json());
if (flags["new-checkout"]) { /* show new flow */ }`;

const replaySnippet = (base: string) => `// Record with rrweb
import * as rrweb from "rrweb";
const buffer = [];
rrweb.record({ emit(e) { buffer.push(e); } });
setInterval(() => {
  if (!buffer.length) return;
  fetch(\`${base}/replay/\${session_id}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ distinct_id, events: buffer.splice(0) }),
  });
}, 5000);`;

function Install() {
  return (
    <div>
      <PageHeader title="Install" description="Copy-paste these into your app" />

      <Card className="p-5">
        <h3 className="mono text-xs uppercase tracking-widest text-muted-foreground">
          1 · Capture events
        </h3>
        <pre className="mono mt-3 overflow-x-auto rounded border border-border bg-secondary/30 p-4 text-xs leading-relaxed">
{snippet(api.base)}
        </pre>
      </Card>

      <Card className="mt-4 p-5">
        <h3 className="mono text-xs uppercase tracking-widest text-muted-foreground">
          2 · Feature flags
        </h3>
        <pre className="mono mt-3 overflow-x-auto rounded border border-border bg-secondary/30 p-4 text-xs leading-relaxed">
{flagSnippet(api.base)}
        </pre>
      </Card>

      <Card className="mt-4 p-5">
        <h3 className="mono text-xs uppercase tracking-widest text-muted-foreground">
          3 · Session replay
        </h3>
        <pre className="mono mt-3 overflow-x-auto rounded border border-border bg-secondary/30 p-4 text-xs leading-relaxed">
{replaySnippet(api.base)}
        </pre>
      </Card>

      <Card className="mt-4 p-5">
        <h3 className="mono text-xs uppercase tracking-widest text-muted-foreground">
          Run everything
        </h3>
        <pre className="mono mt-3 overflow-x-auto rounded border border-border bg-secondary/30 p-4 text-xs leading-relaxed">
{`# in repo root
cd server && npm install && npm run dev   # :4318
cd ..     && docker compose up -d         # ntfy :8081, searxng :8888`}
        </pre>
      </Card>
    </div>
  );
}
