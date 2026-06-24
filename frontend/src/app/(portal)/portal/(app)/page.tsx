"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/fetch";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { ShieldAlert, TrendingUp, CheckCircle, AlertTriangle, Zap, ArrowUpRight } from "lucide-react";
import { PortalPageHeader } from "@/components/portal/page-header";

interface TenantMetrics {
  total_transactions_24h: number;
  fraud_detected_24h: number;
  fraud_rate_pct: number;
  avg_score: number;
  alerts_pending: number;
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function PortalDashboard() {
  const { user } = useAuthStore();
  const { activeTenantId } = useAppStore();
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId = activeTenantId;
    if (!tenantId) return;
    apiFetch(`/api/v1/tenants/${tenantId}/metrics?hours=24`)
      .then(r => r.json())
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <PortalPageHeader
        title={`Bonjour, ${user?.username ?? "—"}`}
        subtitle="Voici l'état de votre détection de fraude sur les 24 dernières heures."
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4 mt-6">
          <StatCard icon={TrendingUp}    label="Transactions analysées" value={metrics.total_transactions_24h.toLocaleString()} sub="dernières 24h" color="bg-blue-500" />
          <StatCard icon={ShieldAlert}   label="Fraudes détectées"      value={metrics.fraud_detected_24h} sub="nouvelles alertes" color="bg-red-500" />
          <StatCard icon={Zap}           label="Taux de fraude"         value={`${metrics.fraud_rate_pct.toFixed(2)} %`} sub="sur total transactions" color="bg-orange-500" />
          <StatCard icon={CheckCircle}   label="Alertes en attente"     value={metrics.alerts_pending} sub="à traiter" color="bg-amber-500" />
        </div>
      ) : (
        <p className="text-muted-foreground mt-6">Impossible de charger les métriques.</p>
      )}

      <div className="mt-8 bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Accès rapide</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Voir mes alertes",      href: "/portal/alertes",    icon: AlertTriangle },
            { label: "Tester une transaction", href: "/portal/scoring",    icon: Zap },
            { label: "Rapport BCEAO",          href: "/portal/conformite", icon: ShieldAlert },
          ].map(({ label, href, icon: Icon }) => (
            <a key={href} href={href} className="flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors group">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Icon className="w-4 h-4 text-blue-500" />
                {label}
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
