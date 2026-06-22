"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/stores/app.store";
import { formatDate } from "@/lib/utils";
import { FileText, Download, RefreshCw, ShieldCheck, Database } from "lucide-react";
import type { ComplianceReport, AuditLogEntry, RetentionStats } from "@/types/api";

export default function ConformitePage() {
  const { activeTenantId } = useAppStore();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useQuery<ComplianceReport>({
    queryKey: ["compliance-report", activeTenantId, fromDate, toDate],
    queryFn: async () => {
      const p = new URLSearchParams({ from_date: fromDate, to_date: toDate, tenant_id: String(activeTenantId) });
      const res = await fetch(`/api/v1/compliance/report?${p}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erreur rapport");
      return res.json();
    },
  });

  const { data: auditData } = useQuery<{ total: number; rows: AuditLogEntry[] }>({
    queryKey: ["audit-log", activeTenantId],
    queryFn: async () => {
      const p = new URLSearchParams({ limit: "20", tenant_id: String(activeTenantId) });
      const res = await fetch(`/api/v1/compliance/audit-log?${p}`, { credentials: "include" });
      if (!res.ok) return { total: 0, rows: [] };
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: retention } = useQuery<RetentionStats>({
    queryKey: ["retention-stats"],
    queryFn: async () => {
      const res = await fetch("/api/v1/compliance/retention-stats", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Conformité BCEAO" subtitle="Rapports réglementaires et journal d'audit" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* BCEAO banner */}
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl border border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-950/10">
          <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Référence réglementaire :</strong> {report?.regulatory_reference ?? "BCEAO Instruction 008-05-2015 — Conservation des données 5 ans"}
          </p>
        </div>

        {/* Filters + Generate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Rapport de conformité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Date de début</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                  className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Date de fin</label>
                <input type="date" value={toDate} readOnly
                  className="h-9 px-3 text-sm rounded-lg border border-border bg-background/60 text-muted-foreground" />
              </div>
              <Button onClick={() => refetchReport()} loading={reportLoading}>
                <RefreshCw className="w-3.5 h-3.5" />
                Générer
              </Button>
              {report && (
                <Button variant="outline">
                  <Download className="w-3.5 h-3.5" />
                  Exporter PDF
                </Button>
              )}
            </div>

            {report && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                {[
                  { label: "Total transactions", value: report.transactions.total.toLocaleString("fr-FR"), color: "text-foreground" },
                  { label: "Fraudes détectées",  value: report.transactions.fraud_detected.toLocaleString("fr-FR"), color: "text-red-500" },
                  { label: "Taux de fraude",     value: (report.transactions.fraud_rate * 100).toFixed(2) + "%", color: "text-amber-600" },
                  { label: "Pseudonymisées",     value: report.transactions.anonymized.toLocaleString("fr-FR"), color: "text-blue-500" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-3 rounded-lg bg-muted/40 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {report && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Par canal</p>
                  {Object.entries(report.transactions.by_channel).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs py-1 border-b border-border/40">
                      <span className="text-foreground">{k}</span>
                      <span className="font-semibold text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Par pays</p>
                  {Object.entries(report.transactions.by_country).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs py-1 border-b border-border/40">
                      <span className="text-foreground">{k}</span>
                      <span className="font-semibold text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Par modèle</p>
                  {Object.entries(report.transactions.by_model_version).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs py-1 border-b border-border/40">
                      <span className="font-mono text-foreground text-[11px]">{k}</span>
                      <span className="font-semibold text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Retention */}
        {retention && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Politique de rétention des données
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Total enregistrements",   value: retention.total_records.toLocaleString("fr-FR") },
                  { label: "Expirés",                  value: retention.expired_records.toLocaleString("fr-FR"), warn: retention.expired_records > 0 },
                  { label: "Pseudonymisés",            value: retention.anonymized_records.toLocaleString("fr-FR") },
                  { label: "Durée de rétention",       value: `${retention.retention_policy_years} ans` },
                ].map(({ label, value, warn }) => (
                  <div key={label} className="p-3 rounded-lg bg-muted/40 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-base font-bold ${warn ? "text-amber-500" : "text-foreground"}`}>{value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">{retention.regulatory_reference}</p>
            </CardContent>
          </Card>
        )}

        {/* Audit log */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Journal d&apos;audit</CardTitle>
            {auditData && (
              <Badge variant="secondary">{auditData.total} entrées</Badge>
            )}
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {!auditData || auditData.rows.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                Aucune entrée d&apos;audit.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Date", "Action", "Acteur", "Ressource", "Résultat"].map((h) => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditData.rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.timestamp)}</td>
                      <td className="px-5 py-2.5 text-xs font-medium text-foreground">{row.action_type}</td>
                      <td className="px-5 py-2.5 text-xs text-muted-foreground">
                        <span className="font-mono">{row.actor_id ?? row.actor_type}</span>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-muted-foreground">
                        {row.resource_type ? `${row.resource_type} #${row.resource_id}` : "—"}
                      </td>
                      <td className="px-5 py-2.5">
                        <Badge variant={row.outcome === "success" ? "success" : "danger"}>
                          {row.outcome}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
