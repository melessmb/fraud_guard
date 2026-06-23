"use client";

import { Sun, Moon, Globe, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { NotificationBell } from "@/components/notifications/notification-bell";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin:        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  tenant_admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  compliance:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  tenant:       "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export function Topbar({ title, subtitle }: TopbarProps) {
  const { user, primaryRole, clearUser } = useAuthStore();
  const { theme, setTheme, locale, setLocale } = useAppStore();
  
  const router = useRouter();
  const role = primaryRole();

  // Apply theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else if (theme === "light") root.classList.remove("dark");
    else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      prefersDark ? root.classList.add("dark") : root.classList.remove("dark");
    }
  }, [theme]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    document.cookie = "fg_token=; path=/; max-age=0";
    clearUser();
    router.push("/login");
  };

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card shrink-0">
      {/* Left — Page title */}
      <div>
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-2">
        {/* Locale toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
          className="text-xs text-muted-foreground gap-1"
        >
          <Globe className="w-3.5 h-3.5" />
          {locale.toUpperCase()}
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="text-muted-foreground"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Notifications temps réel */}
        <NotificationBell />

        {/* Separator */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* User badge */}
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden md:block">
              <div className="text-xs font-semibold text-foreground leading-tight">{user.username}</div>
              {role && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ROLE_COLORS[role] ?? ""}`}>
                  {role}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-destructive"
          title="Déconnexion"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
