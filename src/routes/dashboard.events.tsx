import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/lovehog-api";
import { PageHeader } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/dashboard/events")({
  component: Events,
});

function Events() {
  const [filter, setFilter] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["events", filter],
    queryFn: () => api.events(200, filter || undefined),
    refetchInterval: 4000,
  });

  return (
    <div>
      <PageHeader
        title="Events"
        description="Live event stream from /capture"
        actions={
          <Input
            placeholder="filter by event name"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-64"
          />
        }
      />
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Event</th>
                <th className="p-3">User</th>
                <th className="p-3">URL</th>
                <th className="p-3">Properties</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e: any) => (
                <tr key={e.id} className="border-t border-border hover:bg-secondary/20">
                  <td className="p-3 mono text-xs text-muted-foreground">
                    {new Date(e.ts).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 mono text-xs text-primary">
                      {e.event}
                    </span>
                  </td>
                  <td className="p-3 mono text-xs">{e.distinct_id ?? "—"}</td>
                  <td className="p-3 truncate max-w-[200px] text-xs text-muted-foreground">
                    {e.url ?? "—"}
                  </td>
                  <td className="p-3 mono text-xs text-muted-foreground truncate max-w-[300px]">
                    {e.properties}
                  </td>
                </tr>
              ))}
              {!data.length && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-sm text-muted-foreground">
                    No events yet. POST one to{" "}
                    <code className="mono text-foreground">{api.base}/capture</code>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
