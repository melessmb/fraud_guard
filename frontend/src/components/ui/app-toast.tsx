"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToastStore, type Toast } from "@/lib/stores/toast.store";

const CONFIG = {
  success: { icon: CheckCircle2, cls: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",  text: "text-green-800 dark:text-green-300", bar: "bg-green-500" },
  error:   { icon: XCircle,       cls: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",          text: "text-red-800 dark:text-red-300",     bar: "bg-red-500"   },
  warning: { icon: AlertTriangle, cls: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800", text: "text-amber-800 dark:text-amber-300", bar: "bg-amber-500" },
  info:    { icon: Info,          cls: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",      text: "text-blue-800 dark:text-blue-300",   bar: "bg-blue-500"  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const remove = useToastStore((s) => s.remove);
  const { icon: Icon, cls, text, bar } = CONFIG[toast.type];
  const duration = toast.duration ?? (toast.type === "error" ? 6000 : 4000);

  return (
    <div className={`relative flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg overflow-hidden min-w-[280px] max-w-sm ${cls}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${text}`} />
      <p className={`text-sm font-medium flex-1 ${text}`}>{toast.message}</p>
      <button onClick={() => remove(toast.id)} className={`p-0.5 rounded hover:opacity-70 ${text}`}>
        <X className="w-3.5 h-3.5" />
      </button>
      {/* Progress bar */}
      <div className={`absolute bottom-0 left-0 h-0.5 ${bar} animate-shrink`}
        style={{ animationDuration: `${duration}ms` }} />
    </div>
  );
}

export function AppToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </div>
  );
}
