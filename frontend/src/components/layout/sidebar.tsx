"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import {
  LayoutDashboard, BarChart2, AlertTriangle, Zap,
  Building2, Cpu, FileText, User, Settings, ShieldCheck,
  ChevronLeft, ChevronRight, ArrowLeftRight, GitCompareArrows, Users,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/",           icon: LayoutDashboard },
  { label: "Analytique",      href: "/analytique", icon: BarChart2 },
  { label: "Transactions",     href: "/transactions", icon: ArrowLeftRight },
  { label: "Alertes",         href: "/alertes",    icon: AlertTriangle },
  { label: "Scoring",         href: "/scoring",    icon: Zap },
  { label: "Tenants",         href: "/tenants",    icon: Building2,         roles: ["admin"] },
  { label: "Comparatif",      href: "/comparatif",    icon: GitCompareArrows,  roles: ["admin"] },
  { label: "Utilisateurs",    href: "/utilisateurs",  icon: Users,             roles: ["admin", "tenant_admin"] },
  { label: "Modèles",         href: "/modeles",       icon: Cpu,               roles: ["admin"] },
  { label: "Conformité",      href: "/conformite", icon: FileText,  roles: ["admin", "tenant_admin", "compliance"] },
  { label: "Mon Tenant",      href: "/mon-tenant", icon: Settings,  roles: ["tenant_admin"] },
  { label: "Profil",          href: "/profil",     icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, primaryRole } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  const role = primaryRole();
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-card border-r border-border transition-all duration-200 shrink-0",
        sidebarCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center shadow-sm">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div>
            <div className="text-sm font-bold text-foreground tracking-tight">FraudGuard</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Admin Console</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {!sidebarCollapsed && (
          <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Menu
          </p>
        )}
        {visibleItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  isActive ? "text-green-600 dark:text-green-400" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              {isActive && !sidebarCollapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-border space-y-1">
        {!sidebarCollapsed && (
          <div className="px-3 py-2 rounded-lg bg-secondary/50 flex items-center gap-2">
            <span className="status-dot status-online" />
            <span className="text-xs text-muted-foreground">API en ligne</span>
          </div>
        )}
        {user && (
          <div className={cn("px-3 py-2 rounded-lg flex items-center gap-2", sidebarCollapsed ? "justify-center" : "")}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground truncate">{user.username}</div>
                <div className="text-[10px] text-muted-foreground truncate">{role}</div>
              </div>
            )}
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
