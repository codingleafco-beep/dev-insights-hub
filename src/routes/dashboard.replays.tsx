import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/lovehog-api";
import { PageHeader } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/replays")({
  component: Replays,
});

function Replays() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data = [] } = useQuery({ queryKey: ["replays"], queryFn: api.replays });
  const { data: detail } = useQuery({
    queryKey: ["replay", selected],
    queryFn: () => api.replay(selected!),
    enabled: !!selected,
  });

  return (
    <div>
      <PageHeader
        title="Session replays"
        description="rrweb event streams stored on the server"
      />
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <Card className="overflow-hidden p-0">
          {data.map((r: any) => (
            <button
              key={r.id}
              onClick={() => setSelected(r.id)}
              className={`block w-full border-b border-border p-3 text-left hover:bg-secondary/40 ${
                selected === r.id ? "bg-secondary/60" : ""
              }`}
            >
              <div className="mono text-xs text-primary">{r.id}</div>
              <div className="text-xs text-muted-foreground">
                {r.distinct_id ?? "anon"} · {r.chunks} chunks · {Math.round(r.duration / 1000)}s
              </div>
            </button>
          ))}
          {!data.length && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <p>No replays yet.</p>
              <p className="mt-2">
                Capture rrweb events and POST to{" "}
                <code className="mono text-foreground">/replay/:sessionId</code>.
              </p>
            </div>
          )}
        </Card>
        <Card className="p-5">
          {!selected && (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Select a recording
            </div>
          )}
          {detail && (
            <>
              <div className="mono text-xs text-muted-foreground">
                {detail.recording?.id}
              </div>
              <h3 className="mt-1 text-lg font-bold">
                {detail.events.length} rrweb events
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Wire <code className="mono">rrweb-player</code> to render this — events
                are stored verbatim and ready to feed in.
              </p>
              <pre className="mono mt-4 max-h-[55vh] overflow-auto rounded border border-border bg-secondary/30 p-3 text-xs">
                {JSON.stringify(detail.events.slice(0, 25), null, 2)}
              </pre>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
