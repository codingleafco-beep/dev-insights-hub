import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BellRing,
  Flag,
  Home,
  PlaySquare,
  Search,
  Settings,
  Users,
  Zap,
  TerminalSquare,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const nav = [
  { to: "/dashboard", label: "Overview", icon: Home },
  { to: "/dashboard/events", label: "Events", icon: Activity },
  { to: "/dashboard/sessions", label: "Sessions", icon: Users },
  { to: "/dashboard/replays", label: "Replays", icon: PlaySquare },
  { to: "/dashboard/flags", label: "Feature flags", icon: Flag },
  { to: "/dashboard/notifications", label: "Notifications", icon: BellRing },
  { to: "/dashboard/search", label: "Web search", icon: Search },
  { to: "/dashboard/install", label: "Install", icon: TerminalSquare },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
          <Link to="/" className="mb-8 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            <span className="mono text-sm font-bold tracking-tight">LoveHog</span>
          </Link>
          <nav className="flex flex-col gap-0.5">
            {nav.map((n) => {
              const active =
                n.to === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-md border border-border bg-card/50 p-3 text-xs text-muted-foreground">
            <div className="mono text-foreground">no auth</div>
            <p className="mt-1 leading-relaxed">
              Local dev tool. Run the server and forget about it.
            </p>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="mono text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
