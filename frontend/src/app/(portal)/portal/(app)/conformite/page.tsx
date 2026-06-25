"use client";

import { useState, useEffect, useCallback } from "react";
import { portalFetch } from "@/lib/api/portal-fetch";
import { useAppStore } from "@/lib/stores/app.store";
import { ExportButton } from "@/components/export/export-button";
import { FileText, Calendar, ShieldCheck, AlertTriangle, EyeOff, Activity, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ComplianceReport {
  period_from: string;
  period_to:   string;
  generated_at: string;
  regulatory_reference: string;
  transactions: {
    total:          number;
    fraud_detected: number;
    fraud_rate:     number;
    anonymized:     number;
    by_channel:     Record<string, number>;
    by_country:     Record<string, number>;
    by_model_version: Record<string, number>;
  };
  audit_actions: number;
  data_retention_policy: string;
}

// ── KPI stat ──────────────────────────────────────────────────────────────────

function Stat({ icon: Icon, label, value, sub, color = "blue" }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  color?: "blue" | "red" | "green" | "yellow";
}) {
  const colors = {
    blue:   "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400",
    red:    "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400",
    green:  "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400",
    yellow: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400",
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortalConformitePage() {
  const { activeTenantId } = useAppStore();
  const tenantId = activeTenantId;

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await portalFetch(
        `/api/v1/compliance/report?tenant_id=${tenantId}&from_date=${fromDate}&to_date=${toDate}`
      );
      if (res.ok) setReport(await res.json());
    } finally {
      setLoading(false);
    }
  }, [tenantId, fromDate, toDate]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const EXPORTS = [
    {
      icon: FileText,
      label: "Transactions sur la période",
      desc: "BCEAO Art. 26 — toutes les transactions scorées",
      exports: [
        {
          label: "Toutes les transactions",
          url: `/api/v1/tenants/${tenantId}/export/transactions?date_from=${fromDate}&date_to=${toDate}`,
          filename: `transactions_${fromDate}_${toDate}.csv`,
        },
        {
          label: "Fraudes uniquement",
          url: `/api/v1/tenants/${tenantId}/export/transactions?date_from=${fromDate}&date_to=${toDate}&is_fraud=true`,
          filename: `fraudes_${fromDate}_${toDate}.csv`,
        },
      ],
    },
    {
      icon: FileText,
      label: "Alertes fraude",
      desc: "Liste des alertes et leur statut de traitement",
      exports: [
        {
          label: "Toutes les alertes",
          url: `/api/v1/tenants/${tenantId}/export/alerts?date_from=${fromDate}&date_to=${toDate}`,
          filename: `alertes_${fromDate}_${toDate}.csv`,
        },
        {
          label: "Alertes confirmées",
          url: `/api/v1/tenants/${tenantId}/export/alerts?date_from=${fromDate}&date_to=${toDate}&status=validated`,
          filename: `alertes_confirmees_${fromDate}_${toDate}.csv`,
        },
      ],
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Sélecteur de période */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-card border border-border rounded-xl max-w-xl">
        <Calendar className="w-4 h-4 text-muted-foreground mb-2 shrink-0" />
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Du</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Au</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={loadReport}
          className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
          Actualiser
        </button>
      </div>

      {/* Rapport BCEAO */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement du rapport…
        </div>
      ) : report ? (
        <>
          {/* Référence réglementaire */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-xl text-xs text-blue-700 dark:text-blue-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{report.regulatory_reference}</span>
            <span className="ml-auto opacity-60">Généré le {new Date(report.generated_at).toLocaleString("fr-FR")}</span>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={Activity}    label="Transactions analysées" value={report.transactions.total.toLocaleString()} color="blue" />
            <Stat icon={AlertTriangle} label="Fraudes détectées"   value={report.transactions.fraud_detected.toLocaleString()}
              sub={`${(report.transactions.fraud_rate * 100).toFixed(2)} % du total`} color="red" />
            <Stat icon={EyeOff}      label="Données anonymisées"   value={report.transactions.anonymized.toLocaleString()}
              sub={report.data_retention_policy.split("—")[0].trim()} color="green" />
            <Stat icon={ShieldCheck} label="Actions d'audit"       value={report.audit_actions.toLocaleString()}
              sub="Opérations admin tracées" color="yellow" />
          </div>

          {/* Répartition canaux + pays */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Par canal</h3>
              <div className="space-y-2">
                {Object.entries(report.transactions.by_channel)
                  .sort(([,a],[,b]) => b - a)
                  .map(([channel, count]) => {
                    const pct = report.transactions.total > 0 ? (count / report.transactions.total) * 100 : 0;
                    return (
                      <div key={channel} className="flex items-center gap-2">
                        <span className="w-28 text-xs text-muted-foreground truncate">{channel}</span>
                        <div className="flex-1 bg-muted/30 rounded-full h-4 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500/70 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-12 text-xs font-semibold text-right text-foreground">{count.toLocaleString()}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Par pays</h3>
              <div className="space-y-2">
                {Object.entries(report.transactions.by_country)
                  .sort(([,a],[,b]) => b - a)
                  .map(([country, count]) => {
                    const pct = report.transactions.total > 0 ? (count / report.transactions.total) * 100 : 0;
                    const colors = ["bg-indigo-500/70","bg-violet-500/70","bg-purple-500/70","bg-fuchsia-500/70","bg-pink-500/70"];
                    const ci = Object.keys(report.transactions.by_country).indexOf(country);
                    return (
                      <div key={country} className="flex items-center gap-2">
                        <span className="w-10 text-xs text-muted-foreground font-medium">{country}</span>
                        <div className="flex-1 bg-muted/30 rounded-full h-4 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${colors[ci % colors.length]}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-12 text-xs font-semibold text-right text-foreground">{count.toLocaleString()}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Exports CSV */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Exports réglementaires</h3>
        <div className="grid gap-3 max-w-2xl">
          {EXPORTS.map(({ icon: Icon, label, desc, exports }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
              <ExportButton exports={exports} disabled={!tenantId} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
