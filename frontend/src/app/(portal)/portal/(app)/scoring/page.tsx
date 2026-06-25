"use client";

import { useState } from "react";
import { portalFetch } from "@/lib/api/portal-fetch";
import { useAppStore } from "@/lib/stores/app.store";
import { useToast } from "@/lib/stores/toast.store";
import { Zap, ShieldAlert, CheckCircle, Plus, Trash2, Upload, BarChart3 } from "lucide-react";

interface ScoreResult {
  transaction_id: string;
  score: number;
  is_fraud: boolean;
  model_version: string;
  explanations?: Record<string, unknown> | null;
}

const RISK_STYLE: Record<string, { bg: string; text: string; label: string; badge: string; icon: React.ElementType }> = {
  critical: { bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900", text: "text-red-700 dark:text-red-400", label: "CRITIQUE", badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400", icon: ShieldAlert },
  high:     { bg: "bg-orange-50 dark:bg-orange-950/20 border-orange-200",             text: "text-orange-700 dark:text-orange-400", label: "ÉLEVÉ",   badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400", icon: ShieldAlert },
  medium:   { bg: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200",             text: "text-yellow-700 dark:text-yellow-400", label: "MODÉRÉ",  badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400", icon: ShieldAlert },
  low:      { bg: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900", text: "text-green-700 dark:text-green-400", label: "FAIBLE", badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400", icon: CheckCircle },
};

const CHANNELS = ["mobile_money", "web", "pos", "atm", "ussd"];
const COUNTRIES = ["CI", "SN", "GH", "BJ", "ML", "BF", "TG", "GN"];
const CURRENCIES = ["XOF", "XAF", "GHS", "NGN", "USD", "EUR"];

function getRiskLevel(score: number): string {
  if (score >= 0.8) return "critical";
  if (score >= 0.5) return "high";
  if (score >= 0.3) return "medium";
  return "low";
}

function getRecommendation(score: number): string {
  if (score >= 0.8) return "Bloquer immédiatement.";
  if (score >= 0.5) return "Vérification manuelle requise.";
  if (score >= 0.3) return "Surveiller et journaliser.";
  return "Transaction approuvée.";
}

// ── Formulaire commun ─────────────────────────────────────────────────────────

interface TxnForm {
  amount: string;
  currency: string;
  channel: string;
  country: string;
  device_fingerprint: string;
  ip_address: string;
}

const defaultForm = (): TxnForm => ({
  amount: "", currency: "XOF", channel: "mobile_money", country: "CI",
  device_fingerprint: "", ip_address: "",
});

function TxnFields({ form, onChange }: { form: TxnForm; onChange: (f: TxnForm) => void }) {
  const set = (key: keyof TxnForm, val: string) => onChange({ ...form, [key]: val });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Montant</label>
          <input type="number" min="1" required value={form.amount}
            onChange={e => set("amount", e.target.value)} placeholder="ex : 150000"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Devise</label>
          <select value={form.currency} onChange={e => set("currency", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Canal</label>
          <select value={form.channel} onChange={e => set("channel", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {CHANNELS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Pays</label>
          <select value={form.country} onChange={e => set("country", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {COUNTRIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Onglet scoring unitaire ───────────────────────────────────────────────────

function SingleScoring({ tenantId }: { tenantId: number | null }) {
  const [form, setForm] = useState<TxnForm>(defaultForm());
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setResult(null);
    try {
      const body = {
        transaction_id: `txn_${Date.now()}`,
        tenant_id: tenantId,
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
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const riskLevel = result ? getRiskLevel(result.score) : null;
  const style = riskLevel ? RISK_STYLE[riskLevel] : null;

  return (
    <div className="max-w-lg space-y-4">
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
        <TxnFields form={form} onChange={setForm} />
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Device fingerprint <span className="text-muted-foreground">(optionnel)</span>
          </label>
          <input type="text" value={form.device_fingerprint}
            onChange={e => setForm(f => ({ ...f, device_fingerprint: e.target.value }))}
            placeholder="généré automatiquement si vide"
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
              <p><span className="text-muted-foreground">Score :</span> <strong>{(result.score * 100).toFixed(1)} %</strong></p>
              <p><span className="text-muted-foreground">Verdict :</span> <strong>{result.is_fraud ? "⚠ Fraude détectée" : "✓ Légitime"}</strong></p>
              <p><span className="text-muted-foreground">Recommandation :</span> {getRecommendation(result.score)}</p>
              <p className="text-xs text-muted-foreground pt-1">Modèle : {result.model_version} · ID : {result.transaction_id}</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Onglet batch scoring ──────────────────────────────────────────────────────

function BatchScoring({ tenantId }: { tenantId: number | null }) {
  const toast = useToast();
  const [rows, setRows] = useState<TxnForm[]>([defaultForm()]);
  const [results, setResults] = useState<ScoreResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  const addRow = () => setRows(r => [...r, defaultForm()]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, f: TxnForm) => setRows(r => r.map((v, idx) => idx === i ? f : v));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setLoading(true); setResults(null);
    try {
      const events = rows.map((f, i) => ({
        transaction_id: `txn_batch_${Date.now()}_${i}`,
        tenant_id: tenantId,
        amount: parseFloat(f.amount),
        currency: f.currency,
        channel: f.channel,
        country: f.country,
        device_fingerprint: f.device_fingerprint || `fp_${Date.now()}_${i}`,
        ip_address: f.ip_address || "0.0.0.0",
        timestamp: new Date().toISOString(),
      }));
      const res = await portalFetch(
        `/api/v1/tenants/${tenantId}/events`,
        { method: "POST", body: JSON.stringify({ events }) },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Erreur ${res.status}`);
      }
      const data: ScoreResult[] = await res.json();
      setResults(data);
      toast.success(`${data.length} transaction${data.length > 1 ? "s" : ""} analysée${data.length > 1 ? "s" : ""}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du batch scoring");
    } finally {
      setLoading(false);
    }
  };

  const fraudCount = results?.filter(r => r.is_fraud).length ?? 0;

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Transaction {i + 1}
              </span>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-muted-foreground hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <TxnFields form={row} onChange={f => updateRow(i, f)} />
          </div>
        ))}

        <div className="flex gap-3">
          <button type="button" onClick={addRow}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border hover:bg-accent text-sm text-muted-foreground transition-colors">
            <Plus className="w-4 h-4" /> Ajouter une transaction
          </button>
          <button type="submit" disabled={loading || !tenantId}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            <Upload className="w-4 h-4" />
            {loading ? `Analyse de ${rows.length} transaction${rows.length > 1 ? "s" : ""}…` : `Analyser les ${rows.length} transaction${rows.length > 1 ? "s" : ""}`}
          </button>
        </div>
      </form>

      {results && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Résumé */}
          <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{results.length} résultats</span>
            </div>
            {fraudCount > 0 && (
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                {fraudCount} fraude{fraudCount > 1 ? "s" : ""} détectée{fraudCount > 1 ? "s" : ""}
              </span>
            )}
            {fraudCount === 0 && (
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                Aucune fraude détectée
              </span>
            )}
          </div>

          {/* Tableau des résultats */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Transaction ID</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Score</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Risque</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Recommandation</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const lvl = getRiskLevel(r.score);
                  const s = RISK_STYLE[lvl];
                  return (
                    <tr key={r.transaction_id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.transaction_id}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        <span className={s.text}>{(r.score * 100).toFixed(1)} %</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.badge}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{getRecommendation(r.score)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

type Tab = "single" | "batch";

export default function PortalScoringPage() {
  const { activeTenantId } = useAppStore();
  const [tab, setTab] = useState<Tab>("single");

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted/50 border border-border rounded-xl p-1 w-fit">
        {([["single", "Transaction unique", Zap], ["batch", "Batch", Upload]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? "bg-background shadow-sm text-foreground border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "single" && <SingleScoring tenantId={activeTenantId} />}
      {tab === "batch"  && <BatchScoring  tenantId={activeTenantId} />}
    </div>
  );
}
