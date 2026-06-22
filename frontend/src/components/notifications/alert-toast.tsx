"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { useNotificationsStore, type FraudNotification } from "@/lib/stores/notifications.store";

const RISK_STYLE: Record<string, string> = {
  critical: "border-red-500 bg-red-50 dark:bg-red-950/20",
  high:     "border-orange-500 bg-orange-50 dark:bg-orange-950/20",
  medium:   "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
  low:      "border-blue-500 bg-blue-50 dark:bg-blue-950/20",
};

const RISK_TEXT: Record<string, string> = {
  critical: "text-red-700 dark:text-red-400",
  high:     "text-orange-700 dark:text-orange-400",
  medium:   "text-yellow-700 dark:text-yellow-400",
  low:      "text-blue-700 dark:text-blue-400",
};

function Toast({ n, onDismiss }: { n: FraudNotification; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6_000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className={`flex items-start gap-3 w-80 border-l-4 rounded-r-xl p-3 shadow-lg animate-in slide-in-from-right-full ${RISK_STYLE[n.risk_level] ?? RISK_STYLE.high}`}>
      <ShieldAlert className={`w-4 h-4 mt-0.5 flex-shrink-0 ${RISK_TEXT[n.risk_level]}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold uppercase ${RISK_TEXT[n.risk_level]}`}>
          Fraude détectée — {n.risk_level}
        </p>
        <p className="text-xs text-foreground mt-0.5 font-mono truncate">{n.transaction_id}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {n.amount.toLocaleString()} {n.currency} · {n.channel} · {(n.score * 100).toFixed(0)}%
        </p>
      </div>
      <button onClick={onDismiss} className="p-0.5 rounded hover:bg-black/10 transition-colors flex-shrink-0">
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

export function AlertToastContainer() {
  const { notifications } = useNotificationsStore();
  const [visible, setVisible] = useState<string[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Afficher les toasts pour les nouvelles notifs non lues
    const newest = notifications.filter(n => !n.read && !seenIds.current.has(n.id));
    newest.forEach(n => seenIds.current.add(n.id));
    if (newest.length > 0) {
      setVisible(prev => [...newest.map(n => n.id), ...prev].slice(0, 4));
    }
  }, [notifications]);

  const dismiss = (id: string) => setVisible(prev => prev.filter(v => v !== id));

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {visible.map(id => {
        const n = notifications.find(n => n.id === id);
        if (!n) return null;
        return <Toast key={id} n={n} onDismiss={() => dismiss(id)} />;
      })}
    </div>
  );
}
