"use client";

import { useState } from "react";
import { portalFetch } from "@/lib/api/portal-fetch";
import { useAppStore } from "@/lib/stores/app.store";
import { Zap, ShieldAlert, CheckCircle } from "lucide-react";

interface ScoreResult {
  transaction_id: string;
  score: number;
  is_fraud: boolean;
  model_version: string;
  explanations?: Record<string, unknown> | null;
}

const RISK_STYLE: Record<string, { bg: string; text: string; label: string; icon: React.ElementType }> = {
  critical: { bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900",     text: "text-red-700 dark:text-red-400",     label: "CRITIQUE",  icon: ShieldAlert  },
  high:     { bg: "bg-orange-50 dark:bg-orange-950/20 border-orange-200",                 text: "text-orange-700 dark:text-orange-400", label: "ÉLEVÉ",    icon: ShieldAlert  },
  medium:   { bg: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200",                 text: "text-yellow-700 dark:text-yellow-400", label: "MODÉRÉ",   icon: ShieldAlert  },
  low:      { bg: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900", text: "text-green-700 dark:text-green-400", label: "FAIBLE", icon: CheckCircle },
};

function getRiskLevel(score: number): string {
  if (score >= 0.8) return "critical";
  if (score >= 0.5) return "high";
  if (score >= 0.3) return "medium";
  return "low";
}

function getRecommendation(score: number): string {
  if (score >= 0.8) return "Bloquer la transaction immédiatement.";
  if (score >= 0.5) return "Soumettre à une vérification manuelle.";
  if (score >= 0.3) return "Surveiller et journaliser.";
  return "Transaction approuvée — risque faible.";
}

const CHANNELS = ["mobile_money", "web", "pos", "atm", "ussd"];
const COUNTRIES = ["CI", "SN", "GH", "BJ", "ML", "BF", "TG", "GN"];

export default function PortalScoringPage() {
  const { activeTenantId } = useAppStore();
  const [form, setForm] = useState({
    amount: "",
    currency: "XOF",
    channel: "mobile_money",
    country: "CI",
    device_fingerprint: "",
    ip_address: "",
  });
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setResult(null);
    try {
      const body = {
        transaction_id: `txn_${Date.now()}`,
        tenant_id: activeTenantId,
        amount: parseFloat(form.amount),
        currency: form.currency,
        channel: form.channel,
        country: form.country,
        device_fingerprint: form.device_fingerprint || `fp_${Date.now()}`,
        ip_address: form.ip_address || "0.0.0.0",
        timestamp: new Date().toISOString(),
      };
      const res = await portalFetch("/api/v1/score", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Erreur ${res.status}`);
      }
      setResult(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const riskLevel = result ? getRiskLevel(result.score) : null;
  const style = riskLevel ? (RISK_STYLE[riskLevel] ?? RISK_STYLE.medium) : null;

  return (
    <div className="flex-1 overflow-y-auto p-6">

      <div className="mt-6 max-w-lg space-y-4">
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Montant</label>
              <input type="number" min="1" required value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="ex : 150000"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Devise</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {["XOF", "XAF", "GHS", "NGN", "USD", "EUR"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Canal</label>
              <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CHANNELS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Pays</label>
              <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Device fingerprint <span className="text-muted-foreground">(optionnel)</span>
            </label>
            <input type="text" value={form.device_fingerprint}
              onChange={e => setForm(f => ({ ...f, device_fingerprint: e.target.value }))}
              placeholder="ex : fp_abc123 (généré auto si vide)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Adresse IP <span className="text-muted-foreground">(optionnel)</span>
            </label>
            <input type="text" value={form.ip_address}
              onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))}
              placeholder="ex : 192.168.1.1 (0.0.0.0 si vide)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            <Zap className="w-4 h-4" />
            {loading ? "Analyse en cours…" : "Analyser la transaction"}
          </button>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>

        {result && style && (() => {
          const Icon = style.icon;
          return (
            <div className={`border rounded-xl p-5 ${style.bg}`}>
              <div className={`flex items-center gap-2 font-bold text-lg mb-3 ${style.text}`}>
                <Icon className="w-5 h-5" />
                Risque {style.label}
              </div>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-muted-foreground">Score de fraude :</span> <strong>{(result.score * 100).toFixed(1)} %</strong></p>
                <p><span className="text-muted-foreground">Verdict :</span> <strong>{result.is_fraud ? "⚠ Fraude détectée" : "✓ Transaction légitime"}</strong></p>
                <p><span className="text-muted-foreground">Recommandation :</span> {getRecommendation(result.score)}</p>
                <p className="text-xs text-muted-foreground pt-1">Modèle : {result.model_version} · ID : {result.transaction_id}</p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
