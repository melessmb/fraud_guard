"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, ShieldAlert, X } from "lucide-react";
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

function NotifItem({ n, onRead }: { n: FraudNotification; onRead: () => void }) {
  return (
    <div
      onClick={onRead}
      className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors ${!n.read ? "bg-blue-50/50 dark:bg-blue-950/10" : ""}`}
    >
      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? RISK_DOT[n.risk_level] ?? "bg-gray-400" : "bg-transparent"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-bold uppercase ${RISK_COLOR[n.risk_level]}`}>
            Fraude {n.risk_level}
          </span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {new Date(n.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <p className="text-xs text-foreground mt-0.5 truncate font-mono">{n.transaction_id}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {n.amount.toLocaleString()} {n.currency} · {n.channel} · {n.country}
          {" · "}<span className="font-semibold">{(n.score * 100).toFixed(0)}%</span>
        </p>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead, clear } = useNotificationsStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fermer au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open) markAllRead(); }}
        className="relative p-2 rounded-lg hover:bg-accent transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-bounce">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-xl shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold text-foreground">Alertes temps réel</span>
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button onClick={clear} className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors">
                  Effacer
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-accent transition-colors">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Liste */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-xs">Aucune notification</p>
              </div>
            ) : (
              notifications.map(n => (
                <NotifItem key={n.id} n={n} onRead={() => markRead(n.id)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
