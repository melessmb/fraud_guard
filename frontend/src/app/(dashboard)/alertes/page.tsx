"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/stores/app.store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AlertTriangle, RefreshCw, Download, Filter } from "lucide-react";

const CHANNELS = ["Tous", "Mobile", "Web", "POS", "ATM"];
const STATUSES = ["Tous", "fraud", "review", "legitimate"];

function StatusBadge({ score }: { score: number }) {
  if (score >= 0.7) return <Badge variant="danger">Fraude</Badge>;
  if (score >= 0.5) return <Badge variant="warning">Révision</Badge>;
  return <Badge variant="success">Légitime</Badge>;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 0.7 ? "bg-red-500" : score >= 0.5 ? "bg-amber-500" : "bg-green-500";
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
  const [channel, setChannel] = useState("Tous");
  const [limit, setLimit] = useState(25);

  const { data: alerts = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["alerts-full", activeTenantId, channel, limit],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (channel !== "Tous") params.set("channel", channel);
      const res = await fetch(`/api/v1/tenants/${activeTenantId}/alerts?${params}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const fraudCount  = (alerts as any[]).filter((a) => a.score >= 0.7).length;
  const reviewCount = (alerts as any[]).filter((a) => a.score >= 0.5 && a.score < 0.7).length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Alertes de fraude" subtitle="Transactions suspectes en temps réel" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Summary chips */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-semibold text-red-700 dark:text-red-400">{fraudCount} fraudes</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{reviewCount} révisions</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border">
            <span className="text-xs font-semibold text-muted-foreground">{(alerts as any[]).length} total</span>
          </div>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle>Historique des alertes</CardTitle>
            <div className="flex items-center gap-2">
              {/* Channel filter */}
              <div className="flex items-center gap-1 border border-border rounded-lg p-1">
                {CHANNELS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setChannel(c)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      channel === c
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-3.5 h-3.5" />
                Export
              </Button>
            </div>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                Chargement…
              </div>
            ) : (alerts as any[]).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 opacity-30" />
                <p className="text-sm">Aucune alerte pour ce tenant.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Date", "Transaction ID", "Canal", "Pays", "Montant", "Score", "Statut"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(alerts as any[]).map((alert: any) => (
                        <tr key={alert.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors group">
                          <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(alert.timestamp)}
                          </td>
                          <td className="px-5 py-3">
                            <span className="font-mono text-xs text-foreground">{alert.transaction_id}</span>
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">{alert.channel}</td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">{alert.country ?? "—"}</td>
                          <td className="px-5 py-3 text-xs font-semibold text-foreground whitespace-nowrap">
                            {formatCurrency(alert.amount, alert.currency)}
                          </td>
                          <td className="px-5 py-3"><ScoreBar score={alert.score} /></td>
                          <td className="px-5 py-3"><StatusBadge score={alert.score} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Load more */}
                {(alerts as any[]).length >= limit && (
                  <div className="flex justify-center p-4 border-t border-border">
                    <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 25)}>
                      Charger 25 de plus
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
