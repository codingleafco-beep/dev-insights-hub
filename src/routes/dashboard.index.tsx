import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/lovehog-api";
import { PageHeader } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  component: Overview,
});

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-5">
      <div className="mono text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
    </Card>
  );
}

function Overview() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: api.overview,
    refetchInterval: 5000,
  });

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`Live from ${api.base}`}
      />

      {error && (
        <Card className="mb-6 flex items-start gap-3 border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <div className="font-medium text-foreground">Can't reach the server</div>
            <div className="mt-1 text-muted-foreground">
              Start it with{" "}
              <code className="mono text-foreground">cd server && npm run dev</code>{" "}
              or set <code className="mono">VITE_LOVEHOG_URL</code>.
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Events total" value={data?.total ?? (isLoading ? "…" : 0)} />
        <Stat label="Last 24h" value={data?.last24 ?? (isLoading ? "…" : 0)} />
        <Stat label="Unique users" value={data?.uniqueUsers ?? 0} />
        <Stat label="Sessions" value={data?.sessions ?? 0} />
      </div>

      <Card className="mt-6 p-5">
        <h3 className="mono text-xs uppercase tracking-widest text-muted-foreground">
          Events · last 24h
        </h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.series ?? []}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v) =>
                  new Date(v).toLocaleTimeString([], { hour: "2-digit" })
                }
                stroke="var(--muted-foreground)"
                fontSize={12}
              />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
                labelFormatter={(v) => new Date(v as number).toLocaleString()}
              />
              <Area
                type="monotone"
                dataKey="c"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#g1)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h3 className="mono text-xs uppercase tracking-widest text-muted-foreground">
          Top events
        </h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.topEvents ?? []}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="event" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="c" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
