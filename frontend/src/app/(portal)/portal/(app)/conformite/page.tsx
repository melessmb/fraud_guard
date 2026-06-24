"use client";

import { useState } from "react";
import { usePortalAuthStore } from "@/lib/stores/portal-auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { ExportButton } from "@/components/export/export-button";
import { FileText, Calendar } from "lucide-react";

export default function PortalConformitePage() {
  const { user } = usePortalAuthStore();
  const { activeTenantId } = useAppStore();
  const tenantId = activeTenantId;

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  const REPORTS = [
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
    <div className="flex-1 overflow-y-auto p-6">

      {/* Sélecteur de période */}
      <div className="mt-5 flex items-end gap-3 p-4 bg-card border border-border rounded-xl max-w-lg">
        <Calendar className="w-4 h-4 text-muted-foreground mb-2" />
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
      </div>

      {/* Rapports */}
      <div className="mt-4 grid gap-3 max-w-2xl">
        {REPORTS.map(({ icon: Icon, label, desc, exports }) => (
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
  );
}
