"use client";

import { useEffect, useState, useCallback } from "react";
import { portalFetch } from "@/lib/api/portal-fetch";
import { useAppStore } from "@/lib/stores/app.store";
import { useToast } from "@/lib/stores/toast.store";
import { AlertDrawer, type AlertDetail } from "@/components/alerts/alert-drawer";
import { CheckCircle, AlertTriangle, ChevronRight, ChevronLeft } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  open:         "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  validated:    "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  rejected:     "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Ouvert", under_review: "En cours", validated: "Confirmé", rejected: "Faux positif",
};
const RISK_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  low:      "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
};

interface PagedAlerts {
  total: number;
  page: number;
  page_size: number;
  items: AlertDetail[];
}

export default function PortalAlertesPage() {
  const { activeTenantId } = useAppStore();
  const toast = useToast();

  const [data, setData] = useState<PagedAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [selected, setSelected] = useState<AlertDetail | null>(null);

  const load = useCallback(async (p: number, status: string, risk: string) => {
    const tenantId = activeTenantId;
    if (!tenantId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), page_size: "25" });
      if (status) params.set("status", status);
      if (risk)   params.set("risk_level", risk);
      const res = await portalFetch(`/api/v1/tenants/${tenantId}/alerts?${params}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setData(await res.json());
    } catch (e) {
      toast.error("Impossible de charger les alertes.");
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => { load(page, statusFilter, riskFilter); }, [page, statusFilter, riskFilter, load]);

  const handleFilterChange = (status: string, risk: string) => {
    setPage(1);
    setStatusFilter(status);
    setRiskFilter(risk);
  };

  const handleStatusChange = (updated: AlertDetail) => {
    setData(prev => prev ? {
      ...prev,
      items: prev.items.map(a => a.id === updated.id ? updated : a),
    } : null);
    setSelected(updated);
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;
  const openCount = data?.items.filter(a => a.status === "open").length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto p-6">

      {/* Stats + filtres */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          <span className="text-xs font-semibold text-red-700 dark:text-red-400">{openCount} ouvertes</span>
        </div>
        {data && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border">
            <span className="text-xs font-semibold text-muted-foreground">{data.total} total</span>
          </div>
        )}
      </div>

      {/* Filtres statut */}
      <div className="mt-3 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1 border border-border rounded-lg p-1">
          {[{v:"",l:"Tous"},{v:"open",l:"Ouverts"},{v:"under_review",l:"En cours"},{v:"validated",l:"Confirmés"},{v:"rejected",l:"Faux positifs"}].map(({v,l})=>(
            <button key={v} onClick={() => handleFilterChange(v, riskFilter)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${statusFilter===v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Filtre risque */}
        <select
          value={riskFilter}
          onChange={e => handleFilterChange(statusFilter, e.target.value)}
          className="h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous les niveaux</option>
          <option value="critical">Critique</option>
          <option value="high">Élevé</option>
          <option value="medium">Moyen</option>
          <option value="low">Faible</option>
        </select>
      </div>

      {/* Tableau */}
      {loading && (
        <div className="mt-6 space-y-3">
          {["sk-1","sk-2","sk-3","sk-4","sk-5"].map((key) => (
            <div key={key} className="h-14 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      )}
      {!loading && (!data || data.items.length === 0) && (
        <div className="mt-16 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="font-semibold text-foreground">Aucune alerte</p>
          <p className="text-sm text-muted-foreground mt-1">Rien à traiter pour ces filtres.</p>
        </div>
      )}
      {!loading && data && data.items.length > 0 && (
        <>
          <div className="mt-4 rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {[{k:"transaction",l:"Transaction"},{k:"montant",l:"Montant"},{k:"canal",l:"Canal"},{k:"score",l:"Score"},{k:"risque",l:"Risque"},{k:"statut",l:"Statut"},{k:"date",l:"Date"},{k:"action",l:""}].map(({k,l}) => (
                    <th key={k} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map(alert => (
                  <tr key={alert.id} onClick={() => setSelected(alert)}
                    className="hover:bg-muted/20 transition-colors cursor-pointer group">
                    <td className="px-4 py-3 font-mono text-xs">{alert.transaction_id.slice(0, 14)}…</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold">{alert.amount.toLocaleString()} {alert.currency}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{alert.channel}</td>
                    <td className="px-4 py-3 text-xs font-mono">{(alert.score * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${RISK_BADGE[alert.risk_level] ?? ""}`}>
                        {alert.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[alert.status] ?? ""}`}>
                        {STATUS_LABEL[alert.status] ?? alert.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(alert.timestamp).toLocaleDateString("fr-FR", {day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                    </td>
                    <td className="px-3 py-3">
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {data.page} sur {totalPages} · {data.total} alertes
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-40 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <AlertDrawer
        alert={selected}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
        fetchFn={portalFetch}
      />
    </div>
  );
}
