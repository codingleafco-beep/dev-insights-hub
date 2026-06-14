import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/lovehog-api";
import { PageHeader } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Trash2, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/notifications")({
  component: Notifications,
});

function Notifications() {
  const qc = useQueryClient();
  const { data: rules = [] } = useQuery({ queryKey: ["rules"], queryFn: api.rules });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.settings });

  const [name, setName] = useState("");
  const [event, setEvent] = useState("");
  const [condition, setCondition] = useState("");
  const [topic, setTopic] = useState("");
  const [priority, setPriority] = useState(3);

  const configured = !!settings?.ntfy_url;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Trigger ntfy pushes when events come in"
      />

      {!configured && (
        <Card className="mb-6 border-chart-4/30 bg-chart-4/10 p-4 text-sm">
          <div className="font-medium">ntfy isn't configured.</div>
          <div className="text-muted-foreground">
            Open <a href="/dashboard/settings" className="text-primary underline">Settings</a> and paste a ntfy base URL.
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden p-0">
          {rules.map((r: any) => (
            <div
              key={r.id}
              className="flex items-center justify-between border-b border-border p-4 last:border-0"
            >
              <div>
                <div className="text-sm font-medium">{r.name}</div>
                <div className="mono text-xs text-muted-foreground">
                  on <span className="text-primary">{r.event}</span>
                  {r.condition ? ` where ${r.condition}` : ""} · topic {r.topic || "default"} · p{r.priority}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await api.deleteRule(r.id);
                  qc.invalidateQueries({ queryKey: ["rules"] });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!rules.length && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No rules yet.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mono text-xs uppercase tracking-widest text-muted-foreground">
            New rule
          </h3>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Big purchase" />
            </div>
            <div>
              <Label>Event</Label>
              <Input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="purchase" />
            </div>
            <div>
              <Label>Condition (optional)</Label>
              <Input
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="amount=100&currency=USD"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Simple <code className="mono">key=value&key=value</code> match on properties.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Topic</Label>
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="default" />
              </div>
              <div>
                <Label>Priority 1-5</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!name || !event}
              onClick={async () => {
                await api.createRule({ name, event, condition, topic, priority });
                qc.invalidateQueries({ queryKey: ["rules"] });
                setName("");
                setEvent("");
                setCondition("");
              }}
            >
              Create rule
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={!configured}
              onClick={async () => {
                try {
                  await api.testNotify(topic || undefined);
                  toast.success("Test push sent");
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              <Send className="mr-2 h-4 w-4" /> Send test push
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
