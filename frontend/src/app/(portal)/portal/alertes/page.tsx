"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/fetch";
import { useAuthStore } from "@/lib/stores/auth.store";
import { PortalPageHeader } from "@/components/portal/page-header";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface Alert {
  id: string;
  transaction_id: string;
  risk_level: "critical" | "high" | "medium" | "low";
  score: number;
  status: "open" | "resolved" | "under_review";
  created_at: string;
  details?: Record<string, unknown>;
}

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  open:         AlertTriangle,
  under_review: Clock,
  resolved:     CheckCircle,
};

export default function PortalAlertesPage() {
  const { user } = useAuthStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId = user?.tenantId;
    if (!tenantId) return;
    apiFetch(`/api/v1/tenants/${tenantId}/alerts?limit=50`)
      .then(r => r.json())
      .then(data => setAlerts(Array.isArray(data) ? data : data.items ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <PortalPageHeader title="Mes alertes fraude" subtitle="Transactions signalées comme suspectes sur votre compte." />

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="mt-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="font-semibold text-foreground">Aucune alerte active</p>
          <p className="text-sm text-muted-foreground mt-1">Toutes vos transactions sont dans la norme.</p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Transaction", "Niveau de risque", "Score", "Statut", "Date"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {alerts.map(alert => {
                const StatusIcon = STATUS_ICON[alert.status] ?? AlertTriangle;
                return (
                  <tr key={alert.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{alert.transaction_id}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${RISK_COLORS[alert.risk_level] ?? ""}`}>
                        {alert.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{(alert.score * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <StatusIcon className="w-3.5 h-3.5" />
                        {alert.status === "open" ? "Ouvert" : alert.status === "under_review" ? "En cours" : "Résolu"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(alert.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
