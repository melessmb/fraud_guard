"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/stores/app.store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AlertDrawer, type AlertDetail } from "@/components/alerts/alert-drawer";
import { AlertTriangle, RefreshCw, Download, ChevronRight } from "lucide-react";

const CHANNELS = ["Tous", "Mobile", "Web", "POS", "ATM"];
const STATUSES = [
  { value: "",             label: "Tous" },
  { value: "open",         label: "Ouverts" },
  { value: "under_review", label: "En cours" },
  { value: "validated",    label: "Confirmés" },
  { value: "rejected",     label: "Faux positifs" },
];

const STATUS_BADGE: Record<string, string> = {
  open:         "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  validated:    "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  rejected:     "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Ouvert", under_review: "En cours", validated: "Confirmé", rejected: "Faux positif",
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 0.8 ? "bg-red-500" : score >= 0.5 ? "bg-orange-400" : score >= 0.3 ? "bg-yellow-400" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score * 100}%` }} />
      </div>
      <span className="text-xs font-mono text-foreground">{(score * 100).toFixed(0)}%</span>
    </div>
  );
}

export default function AlertesPage() {
  const { activeTenantId } = useAppStore();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState("Tous");
  const [statusFilter, setStatusFilter] = useState("");
  const [limit, setLimit] = useState(25);
  const [selected, setSelected] = useState<AlertDetail | null>(null);

  const queryKey = ["alerts-full", activeTenantId, channel, statusFilter, limit];

  const { data: alerts = [], isLoading, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (channel !== "Tous") params.set("channel", channel.toLowerCase());
      if (statusFilter) params.set("status", statusFilter);
      const res = await apiFetch(`/api/v1/tenants/${activeTenantId}/alerts?${params}`);
      if (!res.ok) return [];
      return res.json() as Promise<AlertDetail[]>;
    },
    refetchInterval: 30_000,
  });

  const handleStatusChange = (updated: AlertDetail) => {
    // Update in-place without full refetch
    queryClient.setQueryData(queryKey, (old: AlertDetail[] | undefined) =>
      old?.map(a => a.id === updated.id ? updated : a) ?? []
    );
    setSelected(updated);
  };

  const openCount        = (alerts as AlertDetail[]).filter(a => a.status === "open").length;
  const underReviewCount = (alerts as AlertDetail[]).filter(a => a.status === "under_review").length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Alertes de fraude" subtitle="Transactions suspectes — cliquez pour agir" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Chips résumé */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-semibold text-red-700 dark:text-red-400">{openCount} ouvertes</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{underReviewCount} en cours</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border">
            <span className="text-xs font-semibold text-muted-foreground">{(alerts as AlertDetail[]).length} affichées</span>
          </div>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3 flex-wrap gap-3">
            <CardTitle>Historique des alertes</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtre statut */}
              <div className="flex items-center gap-1 border border-border rounded-lg p-1">
                {STATUSES.map(({ value, label }) => (
                  <button key={value} onClick={() => setStatusFilter(value)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      statusFilter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Filtre canal */}
              <div className="flex items-center gap-1 border border-border rounded-lg p-1">
                {CHANNELS.map(c => (
                  <button key={c} onClick={() => setChannel(c)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      channel === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">Chargement…</div>
            ) : (alerts as AlertDetail[]).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 opacity-30" />
                <p className="text-sm">Aucune alerte pour ce filtre.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Date", "Transaction ID", "Canal", "Pays", "Montant", "Score", "Statut", ""].map((h, i) => (
                          <th key={i} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(alerts as AlertDetail[]).map(alert => (
                        <tr
                          key={alert.id}
                          onClick={() => setSelected(alert)}
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer group"
                        >
                          <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(alert.timestamp)}</td>
                          <td className="px-5 py-3 font-mono text-xs text-foreground">{alert.transaction_id}</td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">{alert.channel}</td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">{alert.country ?? "—"}</td>
                          <td className="px-5 py-3 text-xs font-semibold text-foreground whitespace-nowrap">{formatCurrency(alert.amount, alert.currency)}</td>
                          <td className="px-5 py-3"><ScoreBar score={alert.score} /></td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[alert.status] ?? ""}`}>
                              {STATUS_LABEL[alert.status] ?? alert.status}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(alerts as AlertDetail[]).length >= limit && (
                  <div className="flex justify-center p-4 border-t border-border">
                    <Button variant="outline" size="sm" onClick={() => setLimit(l => l + 25)}>
                      Charger 25 de plus
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDrawer
        alert={selected}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
