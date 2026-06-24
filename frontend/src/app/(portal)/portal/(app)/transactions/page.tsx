"use client";

import { useEffect, useState, useCallback } from "react";
import { portalFetch } from "@/lib/api/portal-fetch";
import { useAppStore } from "@/lib/stores/app.store";
import { useToast } from "@/lib/stores/toast.store";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

interface Transaction {
  id: number;
  transaction_id: string;
  amount: number;
  currency: string;
  channel: string;
  country: string;
  score: number;
  is_fraud: boolean;
  risk_level: "low" | "medium" | "high" | "critical";
  status: string;
  created_at: string;
}

interface PagedResult {
  total: number;
  page: number;
  page_size: number;
  items: Transaction[];
}

const RISK_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  low:      "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
};

export default function PortalTransactionsPage() {
  const { activeTenantId } = useAppStore();
  const toast = useToast();
  const [data, setData] = useState<PagedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [isFraud, setIsFraud] = useState("");
  const [riskLevel, setRiskLevel] = useState("");

  const load = useCallback(async (p: number, fraud: string, risk: string) => {
    const tenantId = activeTenantId;
    if (!tenantId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), page_size: "25" });
      if (fraud !== "") params.set("is_fraud", fraud);
      if (risk)         params.set("risk_level", risk);
      const res = await portalFetch(`/api/v1/tenants/${tenantId}/transactions?${params}`);
      if (res.ok) setData(await res.json());
    } catch { toast.error("Impossible de charger les transactions."); }
    finally { setLoading(false); }
  }, [activeTenantId]);

  useEffect(() => { load(page, isFraud, riskLevel); }, [page, isFraud, riskLevel, load]);

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6">

      {/* Filtres compacts */}
      <div className="mt-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Niveau de risque</label>
          <select value={riskLevel} onChange={e => { setRiskLevel(e.target.value); setPage(1); }}
            className="px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            {["", "low", "medium", "high", "critical"].map(v => <option key={v} value={v}>{v || "Tous"}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Type</label>
          <select value={isFraud} onChange={e => { setIsFraud(e.target.value); setPage(1); }}
            className="px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Toutes</option>
            <option value="true">Fraudes uniquement</option>
            <option value="false">Légitimes uniquement</option>
          </select>
        </div>
        <button onClick={() => load(page, isFraud, riskLevel)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {["Transaction", "Montant", "Canal", "Pays", "Score", "Risque", "Type", "Date"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !data?.items.length
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-muted/40 rounded animate-pulse" /></td></tr>
                  ))
                : data?.items.length === 0
                ? <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Aucune transaction trouvée</td></tr>
                : data?.items.map(txn => (
                    <tr key={txn.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{txn.transaction_id.slice(0, 16)}…</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-semibold text-foreground">{txn.amount.toLocaleString()}</span>
                        <span className="text-muted-foreground ml-1 text-xs">{txn.currency}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{txn.channel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{txn.country}</td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{(txn.score * 100).toFixed(0)}%</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${RISK_BADGE[txn.risk_level] ?? ""}`}>
                          {txn.risk_level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {txn.is_fraud
                          ? <span className="text-red-600 dark:text-red-400 font-semibold text-xs">Fraude</span>
                          : <span className="text-green-600 dark:text-green-400 text-xs">Légitime</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(txn.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {data && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Page {data.page} / {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-accent transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" /> Précédent
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-accent transition-colors">
                Suivant <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
