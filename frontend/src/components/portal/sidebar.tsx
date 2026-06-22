"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import {
  LayoutDashboard, AlertTriangle, BarChart2, Zap,
  FileText, Settings, LogOut, ShieldCheck, ChevronLeft, ChevronRight, ArrowLeftRight,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Tableau de bord",   href: "/portal",                  icon: LayoutDashboard },
  { label: "Transactions",      href: "/portal/transactions",      icon: ArrowLeftRight },
  { label: "Mes alertes",       href: "/portal/alertes",           icon: AlertTriangle },
  { label: "Analytique",        href: "/portal/analytique",        icon: BarChart2 },
  { label: "Scoring",           href: "/portal/scoring",           icon: Zap },
  { label: "Conformité BCEAO",  href: "/portal/conformite",        icon: FileText },
  { label: "Configuration",     href: "/portal/configuration",     icon: Settings },
];

export function PortalSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, clearUser } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    clearUser();
    router.push("/login");
  };

  const initials = user?.username.slice(0, 2).toUpperCase() ?? "??";

  return (
    <aside className={cn(
      "flex flex-col h-screen bg-card border-r border-border transition-all duration-200 shrink-0",
      sidebarCollapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div>
            <div className="text-sm font-bold text-foreground tracking-tight">FraudGuard</div>
            <div className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider">Espace Client</div>
          </div>
        )}
      </div>

      {/* Tenant badge */}
      {!sidebarCollapsed && user && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
          <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider mb-0.5">Organisation</p>
          <p className="text-xs font-semibold text-foreground truncate">{user.username}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/portal" ? pathname === "/portal" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon className={cn(
                "w-4 h-4 flex-shrink-0",
                isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground group-hover:text-foreground"
              )} />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              {isActive && !sidebarCollapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-border space-y-1">
        {user && (
          <div className={cn("px-3 py-2 rounded-lg flex items-center gap-2", sidebarCollapsed ? "justify-center" : "")}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground truncate">{user.username}</div>
                <div className="text-[10px] text-muted-foreground">tenant_admin</div>
              </div>
            )}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-sm"
          title={sidebarCollapsed ? "Déconnexion" : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!sidebarCollapsed && <span>Déconnexion</span>}
        </button>
        <button onClick={toggleSidebar} className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
