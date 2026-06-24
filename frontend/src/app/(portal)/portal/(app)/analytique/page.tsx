"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/fetch";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { PortalPageHeader } from "@/components/portal/page-header";

interface MetricsData {
  total_transactions_24h: number;
  fraud_detected_24h: number;
  fraud_rate_pct: number;
  avg_score: number;
  alerts_pending: number;
}

export default function PortalAnalytiquePage() {
  const { user } = useAuthStore();
  const { activeTenantId } = useAppStore();
  const [m24, setM24] = useState<MetricsData | null>(null);
  const [m168, setM168] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId = activeTenantId;
    if (!tenantId) return;
    Promise.all([
      apiFetch(`/api/v1/tenants/${tenantId}/metrics?hours=24`).then(r => r.json()),
      apiFetch(`/api/v1/tenants/${tenantId}/metrics?hours=168`).then(r => r.json()),
    ]).then(([d24, d168]) => { setM24(d24); setM168(d168); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const row = (label: string, v24?: number | string, v168?: number | string) => (
    <tr key={label} className="border-b border-border hover:bg-muted/20">
      <td className="py-3 px-4 text-sm text-muted-foreground">{label}</td>
      <td className="py-3 px-4 text-sm font-semibold text-foreground text-right">{v24 ?? "—"}</td>
      <td className="py-3 px-4 text-sm font-semibold text-foreground text-right">{v168 ?? "—"}</td>
    </tr>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <PortalPageHeader title="Analytique" subtitle="Comparatif des performances de détection sur 24h et 7 jours." />

      {loading ? (
        <div className="mt-6 h-48 bg-card border border-border rounded-xl animate-pulse" />
      ) : (
        <div className="mt-6 bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/40">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Indicateur</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">24h</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">7 jours</th>
              </tr>
            </thead>
            <tbody>
              {row("Transactions analysées", m24?.total_transactions_24h.toLocaleString(), m168?.total_transactions_24h.toLocaleString())}
              {row("Fraudes détectées", m24?.fraud_detected_24h, m168?.fraud_detected_24h)}
              {row("Taux de fraude", m24 ? `${m24.fraud_rate_pct.toFixed(2)} %` : undefined, m168 ? `${m168.fraud_rate_pct.toFixed(2)} %` : undefined)}
              {row("Score moyen", m24 ? (m24.avg_score * 100).toFixed(1) + " %" : undefined, m168 ? (m168.avg_score * 100).toFixed(1) + " %" : undefined)}
              {row("Alertes en attente", m24?.alerts_pending, m168?.alerts_pending)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
