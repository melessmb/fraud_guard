"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/fetch";
import { useAuthStore } from "@/lib/stores/auth.store";
import { PortalPageHeader } from "@/components/portal/page-header";
import { FileText, Download, Loader2 } from "lucide-react";

const REPORT_TYPES = [
  { id: "suspicious_transactions", label: "Transactions suspectes", desc: "BCEAO Art. 26 — déclaration mensuelle" },
  { id: "fraud_summary",           label: "Résumé de fraudes",      desc: "Synthèse des incidents détectés" },
  { id: "kyc_compliance",          label: "Conformité KYC",         desc: "Vérification de l'identité des clients" },
];

export default function PortalConformitePage() {
  const { user } = useAuthStore();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (reportType: string) => {
    const tenantId = user?.tenantId;
    if (!tenantId) return;
    setDownloading(reportType);
    try {
      const res = await apiFetch(`/api/v1/compliance/report?tenant_id=${tenantId}&report_type=${reportType}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <PortalPageHeader title="Conformité BCEAO" subtitle="Téléchargez vos rapports réglementaires pour la Banque Centrale des États de l'Afrique de l'Ouest." />

      <div className="mt-6 grid gap-4 max-w-2xl">
        {REPORT_TYPES.map(({ id, label, desc }) => (
          <div key={id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
            <button
              onClick={() => handleDownload(id)}
              disabled={downloading === id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex-shrink-0"
            >
              {downloading === id
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> En cours…</>
                : <><Download className="w-3.5 h-3.5" /> Télécharger</>
              }
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
