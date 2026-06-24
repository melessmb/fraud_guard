"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, ShieldAlert, X, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useNotificationsStore, type FraudNotification } from "@/lib/stores/notifications.store";

const RISK_COLOR: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  high:     "text-orange-500 dark:text-orange-400",
  medium:   "text-yellow-600 dark:text-yellow-400",
  low:      "text-blue-500 dark:text-blue-400",
};

const RISK_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-500",
  medium:   "bg-yellow-500",
  low:      "bg-blue-500",
};

const RISK_BG: Record<string, string> = {
  critical: "bg-red-50 dark:bg-red-950/20",
  high:     "bg-orange-50 dark:bg-orange-950/15",
  medium:   "bg-yellow-50 dark:bg-yellow-950/15",
  low:      "bg-blue-50 dark:bg-blue-950/15",
};

function NotifItem({ n, onRead }: { n: FraudNotification; onRead: () => void }) {
  return (
    <div
      onClick={onRead}
      className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors border-b border-border/50 last:border-0 ${!n.read ? RISK_BG[n.risk_level] : ""}`}
    >
      {/* Point indicateur non-lu */}
      <div className="mt-1.5 flex-shrink-0">
        {n.read
          ? <div className="w-2 h-2 rounded-full bg-transparent border border-border" />
          : <div className={`w-2 h-2 rounded-full ${RISK_DOT[n.risk_level] ?? "bg-gray-400"}`} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`text-xs font-bold uppercase tracking-wide ${RISK_COLOR[n.risk_level]}`}>
            Fraude {n.risk_level}
          </span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">
            {new Date(n.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <p className="text-xs font-mono text-foreground truncate">{n.transaction_id}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          <span className="font-semibold text-foreground">{n.amount.toLocaleString()} {n.currency}</span>
          {" · "}{n.channel}{" · "}{n.country}
          {" · "}<span className={`font-semibold ${RISK_COLOR[n.risk_level]}`}>{(n.score * 100).toFixed(0)}%</span>
        </p>
      </div>
    </div>
  );
}

export function NotificationBell({ alertsHref = "/alertes" }: { alertsHref?: string }) {
  const { notifications, unreadCount, markAllRead, markRead, clear } = useNotificationsStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Les 5 notifications les plus récentes affichées dans le dropdown
  const recent = notifications.slice(0, 5);
  const hasMore = notifications.length > 5;

  // Fermer au clic extérieur + marquer comme lu à la fermeture
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        markAllRead();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [markAllRead]);

  const handleOpen = () => {
    setOpen(o => !o);
  };

  const handleClose = () => {
    setOpen(false);
    markAllRead();
  };

  return (
    <div ref={ref} className="relative">
      {/* Bouton cloche */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-accent transition-colors"
        title={unreadCount > 0 ? `${unreadCount} nouvelle${unreadCount > 1 ? "s" : ""} alerte${unreadCount > 1 ? "s" : ""}` : "Notifications"}
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? "text-foreground" : "text-muted-foreground"}`} />

        {/* Badge compteur */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-xl shadow-2xl overflow-hidden z-50">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {notifications.length > 0 && (
                <span className="text-xs bg-muted border border-border text-muted-foreground px-1.5 py-0.5 rounded-full font-mono">
                  {notifications.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button
                  onClick={clear}
                  className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors"
                >
                  Effacer tout
                </button>
              )}
              <button onClick={handleClose} className="p-1 rounded hover:bg-accent transition-colors">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Liste des 5 dernières */}
          <div className="divide-y divide-border/50">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Bell className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-xs font-medium">Aucune notification</p>
                <p className="text-[11px] text-muted-foreground/70">Les alertes fraude apparaîtront ici</p>
              </div>
            ) : (
              recent.map(n => (
                <NotifItem key={n.id} n={n} onRead={() => markRead(n.id)} />
              ))
            )}
          </div>

          {/* Footer — lien vers page alertes si plus de 5 */}
          {(hasMore || recent.length > 0) && (
            <div className="border-t border-border bg-muted/20 px-4 py-2.5 flex items-center justify-between">
              {hasMore ? (
                <span className="text-[11px] text-muted-foreground">
                  +{notifications.length - 5} autres alertes
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  {notifications.length} alerte{notifications.length > 1 ? "s" : ""} au total
                </span>
              )}
              <Link
                href={alertsHref}
                onClick={handleClose}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Voir toutes <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
