"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/fetch";
import { useAuthStore } from "@/lib/stores/auth.store";
import { PortalPageHeader } from "@/components/portal/page-header";
import { Zap, ShieldAlert, CheckCircle } from "lucide-react";

interface ScoreResult {
  transaction_id: string;
  fraud_probability: number;
  risk_level: "low" | "medium" | "high" | "critical";
  recommendation: string;
  processing_time_ms: number;
}

const RISK_STYLE: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  critical: { bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900",    text: "text-red-700 dark:text-red-400",    icon: ShieldAlert },
  high:     { bg: "bg-orange-50 dark:bg-orange-950/20 border-orange-200",                text: "text-orange-700 dark:text-orange-400", icon: ShieldAlert },
  medium:   { bg: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200",                text: "text-yellow-700 dark:text-yellow-400", icon: ShieldAlert },
  low:      { bg: "bg-green-50 dark:bg-green-950/20 border-green-200",                   text: "text-green-700 dark:text-green-400",   icon: CheckCircle },
};

export default function PortalScoringPage() {
  const { user } = useAuthStore();
  const [form, setForm] = useState({ amount: "", merchant: "", customer_id: "" });
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setResult(null);
    try {
      const body = {
        transaction_id: `txn_${Date.now()}`,
        tenant_id: user?.tenantId,
        amount: parseFloat(form.amount),
        merchant_id: form.merchant,
        customer_id: form.customer_id,
        timestamp: new Date().toISOString(),
      };
      const res = await apiFetch("/api/v1/score", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setResult(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <PortalPageHeader title="Scoring de transaction" subtitle="Analysez une transaction pour évaluer son niveau de risque." />

      <div className="mt-6 max-w-lg">
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Montant (FCFA)</label>
            <input
              type="number" min="1" required
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="ex : 150000"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">ID Marchand</label>
            <input
              type="text" required
              value={form.merchant}
              onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))}
              placeholder="ex : merchant_001"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">ID Client</label>
            <input
              type="text" required
              value={form.customer_id}
              onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
              placeholder="ex : cust_456"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            <Zap className="w-4 h-4" />
            {loading ? "Analyse en cours…" : "Analyser la transaction"}
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>

        {result && (() => {
          const style = RISK_STYLE[result.risk_level] ?? RISK_STYLE.medium;
          const Icon = style.icon;
          return (
            <div className={`mt-4 border rounded-xl p-5 ${style.bg}`}>
              <div className={`flex items-center gap-2 font-bold text-lg mb-3 ${style.text}`}>
                <Icon className="w-5 h-5" />
                Risque {result.risk_level.toUpperCase()}
              </div>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Probabilité de fraude :</span> <strong>{(result.fraud_probability * 100).toFixed(1)} %</strong></p>
                <p><span className="text-muted-foreground">Recommandation :</span> {result.recommendation}</p>
                <p className="text-xs text-muted-foreground mt-2">Traitement : {result.processing_time_ms} ms · ID : {result.transaction_id}</p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
