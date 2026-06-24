"use client";

import { Sun, Moon } from "lucide-react";
import { useAppStore } from "@/lib/stores/app.store";
import { useEffect } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";

interface PortalTopbarProps {
  title: string;
  subtitle?: string;
}

export function PortalTopbar({ title, subtitle }: PortalTopbarProps) {
  const { theme, setTheme } = useAppStore();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else if (theme === "light") root.classList.remove("dark");
    else {
      const prefersDark = globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
      prefersDark ? root.classList.add("dark") : root.classList.remove("dark");
    }
  }, [theme]);

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card shrink-0">
      <div>
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <NotificationBell alertsHref="/portal/alertes" />
      </div>
    </header>
  );
}
