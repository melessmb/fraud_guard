"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api/fetch";
import { useAuthStore } from "@/lib/stores/auth.store";
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

interface Transaction {
  id: number;
  transaction_id: string;
  tenant_id: number;
  amount: number;
  currency: string;
  channel: string;
  country: string;
  score: number;
  is_fraud: boolean;
  risk_level: "low" | "medium" | "high" | "critical";
  model_version: string;
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

export default function TransactionsPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<PagedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    risk_level: "", is_fraud: "", channel: "", country: "",
    date_from: "", date_to: "", tenant_id: "",
  });

  const isAdmin = user?.roles.includes("admin");

  const fetch = useCallback(async (p: number, f: typeof filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), page_size: "25" });
      if (f.risk_level) params.set("risk_level", f.risk_level);
      if (f.is_fraud !== "") params.set("is_fraud", f.is_fraud);
      if (f.channel)    params.set("channel", f.channel);
      if (f.country)    params.set("country", f.country);
      if (f.date_from)  params.set("date_from", f.date_from);
      if (f.date_to)    params.set("date_to", f.date_to);

      const tenantId = isAdmin ? (f.tenant_id || "1") : user?.tenantId;
      if (!tenantId) return;

      const res = await apiFetch(`/api/v1/tenants/${tenantId}/transactions?${params}`);
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user, isAdmin]);

  useEffect(() => { fetch(page, filters); }, [page, filters, fetch]);

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data ? `${data.total.toLocaleString()} transactions au total` : "Chargement…"}
          </p>
        </div>
        <button onClick={() => fetch(page, filters)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" /> Filtres
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Tenant ID</label>
            <input
              type="number" placeholder="1"
              value={filters.tenant_id}
              onChange={e => setFilter("tenant_id", e.target.value)}
              className="px-2 py-1.5 rounded-md border border-border bg-background text-sm w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {[
          { key: "risk_level" as const, label: "Risque", options: ["", "low", "medium", "high", "critical"] },
          { key: "is_fraud" as const, label: "Fraude", options: [{ v: "", l: "Tous" }, { v: "true", l: "Oui" }, { v: "false", l: "Non" }] },
        ].map(({ key, label, options }) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{label}</label>
            <select
              value={filters[key]}
              onChange={e => setFilter(key, e.target.value)}
              className="px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {options.map(o => typeof o === "string"
                ? <option key={o} value={o}>{o || "Tous"}</option>
                : <option key={o.v} value={o.v}>{o.l}</option>
              )}
            </select>
          </div>
        ))}

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Canal</label>
          <input
            placeholder="mobile, web…"
            value={filters.channel}
            onChange={e => setFilter("channel", e.target.value)}
            className="px-2 py-1.5 rounded-md border border-border bg-background text-sm w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Du</label>
          <input type="date" value={filters.date_from} onChange={e => setFilter("date_from", e.target.value)}
            className="px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Au</label>
          <input type="date" value={filters.date_to} onChange={e => setFilter("date_to", e.target.value)}
            className="px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {["Transaction ID", "Montant", "Canal", "Pays", "Score", "Risque", "Fraude", "Modèle", "Date"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !data?.items.length ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-4 bg-muted/40 rounded animate-pulse" /></td></tr>
                ))
              ) : data?.items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Aucune transaction trouvée</td></tr>
              ) : data?.items.map(txn => (
                <tr key={txn.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">
                    <span className="truncate max-w-[160px] inline-block">{txn.transaction_id}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-semibold text-foreground">{txn.amount.toLocaleString()}</span>
                    <span className="text-muted-foreground ml-1 text-xs">{txn.currency}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{txn.channel}</td>
                  <td className="px-4 py-3 text-muted-foreground">{txn.country}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${txn.score >= 0.8 ? "bg-red-500" : txn.score >= 0.5 ? "bg-orange-400" : txn.score >= 0.3 ? "bg-yellow-400" : "bg-green-500"}`}
                          style={{ width: `${txn.score * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-foreground">{(txn.score * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${RISK_BADGE[txn.risk_level] ?? ""}`}>
                      {txn.risk_level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {txn.is_fraud
                      ? <span className="text-red-600 dark:text-red-400 font-semibold text-xs">✕ Fraude</span>
                      : <span className="text-green-600 dark:text-green-400 text-xs">✓ Légitime</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{txn.model_version}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(txn.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {data.page} / {totalPages} · {data.total.toLocaleString()} résultats
            </p>
            <div className="flex items-center gap-2">
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
