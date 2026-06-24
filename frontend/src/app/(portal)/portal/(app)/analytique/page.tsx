"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api/portal-fetch";
import { useAppStore } from "@/lib/stores/app.store";
import { useToast } from "@/lib/stores/toast.store";

interface MetricsData {
  transaction_count: number;
  fraud_count: number;
  detection_rate: number;
  false_positive_rate: number;
  model_version: string;
}

export default function PortalAnalytiquePage() {
  const { activeTenantId } = useAppStore();
  const toast = useToast();
  const [m24, setM24] = useState<MetricsData | null>(null);
  const [m168, setM168] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId = activeTenantId;
    if (!tenantId) return;
    Promise.all([
      portalFetch(`/api/v1/tenants/${tenantId}/metrics?hours=24`).then(r => r.json()),
      portalFetch(`/api/v1/tenants/${tenantId}/metrics?hours=168`).then(r => r.json()),
    ]).then(([d24, d168]) => { setM24(d24); setM168(d168); })
      .catch(() => toast.error("Impossible de charger les métriques."))
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
              {row("Transactions analysées", m24?.transaction_count.toLocaleString(), m168?.transaction_count.toLocaleString())}
              {row("Fraudes détectées", m24?.fraud_count, m168?.fraud_count)}
              {row("Taux de fraude", m24 ? `${(m24.detection_rate * 100).toFixed(2)} %` : undefined, m168 ? `${(m168.detection_rate * 100).toFixed(2)} %` : undefined)}
              {row("Faux positifs", m24 ? `${(m24.false_positive_rate * 100).toFixed(2)} %` : undefined, m168 ? `${(m168.false_positive_rate * 100).toFixed(2)} %` : undefined)}
              {row("Transactions légitimes", m24 ? (m24.transaction_count - m24.fraud_count).toLocaleString() : undefined, m168 ? (m168.transaction_count - m168.fraud_count).toLocaleString() : undefined)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
