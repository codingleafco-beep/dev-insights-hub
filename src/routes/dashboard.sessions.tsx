import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/lovehog-api";
import { PageHeader } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/sessions")({
  component: Sessions,
});

function Sessions() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: api.sessions,
    refetchInterval: 5000,
  });
  const { data: detail } = useQuery({
    queryKey: ["session", selected],
    queryFn: () => api.session(selected!),
    enabled: !!selected,
  });

  return (
    <div>
      <PageHeader title="Sessions" description="Live user sessions" />
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <Card className="overflow-hidden p-0">
          <div className="max-h-[70vh] overflow-y-auto">
            {data.map((s: any) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`block w-full border-b border-border p-3 text-left text-sm hover:bg-secondary/40 ${
                  selected === s.id ? "bg-secondary/60" : ""
                }`}
              >
                <div className="mono text-xs text-primary">{s.id}</div>
                <div className="text-xs text-muted-foreground">
                  {s.distinct_id ?? "anon"} · {s.events} events · {s.pageviews} pv
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(s.last_seen_at).toLocaleString()}
                </div>
              </button>
            ))}
            {!data.length && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No sessions yet.
              </div>
            )}
          </div>
        </Card>
        <Card className="p-5">
          {!selected && (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Select a session
            </div>
          )}
          {detail && (
            <>
              <div className="mono text-xs text-muted-foreground">
                {detail.session?.id}
              </div>
              <h3 className="mt-1 text-lg font-bold">
                {detail.session?.distinct_id ?? "anonymous"}
              </h3>
              <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
                {detail.events.map((e: any) => (
                  <div
                    key={e.id}
                    className="rounded border border-border bg-secondary/30 p-2 text-xs"
                  >
                    <div className="flex justify-between">
                      <span className="mono text-primary">{e.event}</span>
                      <span className="text-muted-foreground">
                        {new Date(e.ts).toLocaleTimeString()}
                      </span>
                    </div>
                    {e.url && (
                      <div className="mt-0.5 truncate text-muted-foreground">{e.url}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
