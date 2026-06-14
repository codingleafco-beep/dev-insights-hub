import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/lovehog-api";
import { PageHeader } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/settings")({
  component: Settings,
});

function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [form, setForm] = useState({ ntfy_url: "", ntfy_topic: "lovehog", searxng_url: "" });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function save() {
    await api.saveSettings(form);
    qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success("Saved");
  }

  return (
    <div>
      <PageHeader title="Settings" description="Wire up ntfy and SearXNG" />
      <Card className="p-6">
        <div className="grid gap-5">
          <div>
            <Label>ntfy base URL</Label>
            <Input
              value={form.ntfy_url}
              onChange={(e) => setForm({ ...form, ntfy_url: e.target.value })}
              placeholder="http://localhost:8081"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              From <code className="mono">docker compose up</code> → http://localhost:8081
            </p>
          </div>
          <div>
            <Label>Default ntfy topic</Label>
            <Input
              value={form.ntfy_topic}
              onChange={(e) => setForm({ ...form, ntfy_topic: e.target.value })}
              placeholder="lovehog"
            />
          </div>
          <div>
            <Label>SearXNG base URL</Label>
            <Input
              value={form.searxng_url}
              onChange={(e) => setForm({ ...form, searxng_url: e.target.value })}
              placeholder="http://localhost:8888"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={save}>Save settings</Button>
          </div>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h3 className="mono text-xs uppercase tracking-widest text-muted-foreground">
          Server
        </h3>
        <p className="mt-2 text-sm">
          Talking to <code className="mono text-primary">{api.base}</code>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Set <code className="mono">VITE_LOVEHOG_URL</code> to point at a different server.
        </p>
      </Card>
    </div>
  );
}
