import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  api,
  getActiveProjectId,
  setActiveProjectId,
  type Project,
} from "@/lib/lovehog-api";
import { toast } from "sonner";
import { Copy, KeyRound, Trash2, RotateCw, Check } from "lucide-react";

export const Route = createFileRoute("/dashboard/projects")({
  component: Projects,
});

function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const activeId = getActiveProjectId();

  async function load() {
    setProjects(await api.projects());
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    try {
      const p = await api.createProject(name.trim());
      setName("");
      toast.success(`Created ${p.name}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function rotate(id: string) {
    if (!confirm("Rotate API key? Existing SDK clients will break.")) return;
    try {
      await api.rotateKey(id);
      toast.success("Key rotated");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this project and all its data?")) return;
    try {
      await api.deleteProject(id);
      toast.success("Project deleted");
      if (activeId === id) localStorage.removeItem("lh.projectId");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function copy(value: string) {
    navigator.clipboard.writeText(value);
    toast.success("Copied");
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Each project gets its own API key. Use it in your SDK to scope events, flags, sessions, and notifications."
      />

      <Card className="mb-6 p-4">
        <div className="flex gap-2">
          <Input
            placeholder="New project name (e.g. checkout-app)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Button onClick={create}>Create project</Button>
        </div>
      </Card>

      <div className="space-y-3">
        {projects.map((p) => {
          const isActive = p.id === activeId;
          const show = revealed[p.id];
          return (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="mono text-sm font-bold">{p.name}</h3>
                    {isActive && (
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 mono text-[10px] text-primary">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="mono mt-1 text-[11px] text-muted-foreground">
                    id: {p.id}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveProjectId(p.id);
                        toast.success(`Switched to ${p.name}`);
                        window.location.reload();
                      }}
                    >
                      <Check className="h-3.5 w-3.5" /> Switch to
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => rotate(p.id)}>
                    <RotateCw className="h-3.5 w-3.5" /> Rotate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remove(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded border border-border bg-secondary/30 px-3 py-2">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                <code className="mono flex-1 text-xs">
                  {show ? p.api_key : p.api_key.replace(/.(?=.{6})/g, "•")}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRevealed((r) => ({ ...r, [p.id]: !show }))}
                >
                  {show ? "Hide" : "Reveal"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copy(p.api_key)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
        {!projects.length && (
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        )}
      </div>
    </div>
  );
}
