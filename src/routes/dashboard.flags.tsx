import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/lovehog-api";
import { PageHeader } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/dashboard/flags")({
  component: Flags,
});

function Flags() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["flags"], queryFn: api.flags });
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [rollout, setRollout] = useState(100);

  async function save(payload: any) {
    await api.saveFlag(payload);
    qc.invalidateQueries({ queryKey: ["flags"] });
  }

  return (
    <div>
      <PageHeader title="Feature flags" description="Boolean flags with percentage rollout" />
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden p-0">
          {data.map((f: any) => (
            <div
              key={f.key}
              className="flex items-center justify-between gap-3 border-b border-border p-4 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="mono text-sm text-primary">{f.key}</span>
                  <span className="text-xs text-muted-foreground">{f.rollout}%</span>
                </div>
                <div className="text-xs text-muted-foreground">{f.description || "—"}</div>
              </div>
              <Switch
                checked={!!f.enabled}
                onCheckedChange={(v) => save({ ...f, enabled: v })}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await api.deleteFlag(f.key);
                  qc.invalidateQueries({ queryKey: ["flags"] });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!data.length && (
            <div className="p-8 text-center text-sm text-muted-foreground">No flags yet.</div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mono text-xs uppercase tracking-widest text-muted-foreground">
            New flag
          </h3>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Key</Label>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="new-checkout"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What this flag does"
              />
            </div>
            <div>
              <Label>Rollout %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={rollout}
                onChange={(e) => setRollout(Number(e.target.value))}
              />
            </div>
            <Button
              className="w-full"
              disabled={!key}
              onClick={async () => {
                await save({ key, name: key, description: name, rollout, enabled: true });
                setKey("");
                setName("");
                setRollout(100);
              }}
            >
              Create flag
            </Button>
          </div>
          <div className="mt-6 rounded border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
            <div className="mono text-foreground">Evaluate</div>
            <code className="mono mt-1 block break-all">
              GET {api.base}/flags/evaluate?distinct_id=user_123
            </code>
          </div>
        </Card>
      </div>
    </div>
  );
}
