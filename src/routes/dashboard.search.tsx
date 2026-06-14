import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/lovehog-api";
import { PageHeader } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export const Route = createFileRoute("/dashboard/search")({
  component: WebSearch,
});

function WebSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.search(q);
      setResults(data.results ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Web search"
        description="Powered by SearXNG running as a server-side service"
      />
      <Card className="p-5">
        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="Search the web…"
          />
          <Button onClick={go} disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Searching…" : "Search"}
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error} — make sure <code className="mono">searxng_url</code> is set in Settings.
          </div>
        )}

        <div className="mt-6 space-y-4">
          {results.map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded border border-border bg-secondary/30 p-4 transition-colors hover:border-primary/40"
            >
              <div className="mono truncate text-xs text-muted-foreground">{r.url}</div>
              <div className="mt-1 font-medium text-primary">{r.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{r.content}</div>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
