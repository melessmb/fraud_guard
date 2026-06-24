"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/fetch";
import {
  X, ShieldAlert, CheckCircle, Clock, XCircle,
  Hash, DollarSign, Smartphone, Globe, Cpu, Calendar, Sparkles,
} from "lucide-react";

export interface ShapExplanations {
  shap_values: Record<string, number>;
  base_value: number;
  model_auc?: number;
  note?: string;
}

export interface AlertDetail {
  id: number;
  transaction_id: string;
  tenant_id: number;
  score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  channel: string;
  country: string;
  amount: number;
  currency: string;
  model_version: string;
  timestamp: string;
  status: string;
  explanations?: {
    shap_values?: Record<string, number>;
    base_value?: number;
    model_auc?: number;
    note?: string;
    hook_override?: Record<string, unknown>;
    hook_context?: Record<string, unknown>;
  } | null;
}

interface Props {
  alert: AlertDetail | null;
  onClose: () => void;
  onStatusChange: (updated: AlertDetail) => void;
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
}

const RISK_STYLE: Record<string, { bar: string; badge: string; label: string }> = {
  critical: { bar: "bg-red-500",    badge: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",          label: "Critique" },
  high:     { bar: "bg-orange-500", badge: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400", label: "Élevé" },
  medium:   { bar: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400", label: "Moyen" },
  low:      { bar: "bg-green-500",  badge: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",    label: "Faible" },
};

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  open:         { label: "Ouvert",           icon: ShieldAlert, color: "text-red-500" },
  under_review: { label: "En cours",         icon: Clock,       color: "text-amber-500" },
  validated:    { label: "Fraude confirmée", icon: XCircle,     color: "text-red-600" },
  rejected:     { label: "Faux positif",     icon: CheckCircle, color: "text-green-600" },
};

const ACTIONS = [
  { status: "validated",    label: "Confirmer fraude",  icon: XCircle,     style: "bg-red-600 hover:bg-red-700 text-white" },
  { status: "rejected",     label: "Faux positif",      icon: CheckCircle, style: "bg-green-600 hover:bg-green-700 text-white" },
  { status: "under_review", label: "Mettre en attente", icon: Clock,       style: "bg-amber-500 hover:bg-amber-600 text-white" },
  { status: "open",         label: "Rouvrir",           icon: ShieldAlert, style: "border border-border text-foreground hover:bg-accent" },
];

// Human-readable feature names
const FEATURE_LABELS: Record<string, string> = {
  amount_log:   "Montant (log)",
  hour:         "Heure de la transaction",
  channel_enc:  "Canal",
  country_enc:  "Pays",
  velocity_1h:  "Vélocité 1h",
  velocity_24h: "Vélocité 24h",
  device_known: "Appareil connu",
  is_night:     "Transaction nocturne",
};

function ShapChart({ shap_values, base_value }: { shap_values: Record<string, number>; base_value: number }) {
  const entries = Object.entries(shap_values)
    .map(([k, v]) => ({ key: k, label: FEATURE_LABELS[k] ?? k, value: v }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const maxAbs = Math.max(...entries.map(e => Math.abs(e.value)), 0.01);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
        <span>← réduit la fraude</span>
        <span>augmente la fraude →</span>
      </div>
      {entries.map(({ key, label, value }) => {
        const pct = Math.abs(value) / maxAbs * 100;
        const isPositive = value >= 0;
        return (
          <div key={key} className="flex items-center gap-2 group">
            <span className="text-[11px] text-muted-foreground w-36 shrink-0 truncate group-hover:text-foreground transition-colors" title={label}>
              {label}
            </span>
            <div className="flex-1 flex items-center gap-1 h-5">
              {/* Barre négative (réduit) */}
              <div className="flex-1 flex justify-end">
                {!isPositive && (
                  <div
                    className="h-3.5 rounded-l bg-green-400 dark:bg-green-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              {/* Ligne centrale */}
              <div className="w-px h-4 bg-border shrink-0" />
              {/* Barre positive (augmente) */}
              <div className="flex-1">
                {isPositive && (
                  <div
                    className="h-3.5 rounded-r bg-red-400 dark:bg-red-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
            </div>
            <span className={`text-[11px] font-mono w-14 text-right shrink-0 ${isPositive ? "text-red-500" : "text-green-600"}`}>
              {value >= 0 ? "+" : ""}{value.toFixed(3)}
            </span>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
        Valeur de base (prior) : <span className="font-mono">{base_value.toFixed(3)}</span>
      </p>
    </div>
  );
}

export function AlertDrawer({ alert, onClose, onStatusChange, fetchFn = apiFetch }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  if (!alert) return null;

  const risk = RISK_STYLE[alert.risk_level] ?? RISK_STYLE.high;
  const statusInfo = STATUS_META[alert.status] ?? STATUS_META.open;
  const StatusIcon = statusInfo.icon;

  const shap = alert.explanations?.shap_values;
  const baseValue = alert.explanations?.base_value ?? 0;
  const modelAuc = alert.explanations?.model_auc;
  const hasShap = shap && Object.keys(shap).length > 0 && !alert.explanations?.note;

  const handleAction = async (newStatus: string) => {
    setLoading(newStatus);
    setError("");
    try {
      const res = await fetchFn(`/api/v1/tenants/${alert.tenant_id}/alerts/${alert.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus, comment: comment || undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? `Erreur ${res.status}`);
      }
      onStatusChange(await res.json());
      setComment("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l border-border flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <h2 className="font-bold text-foreground text-sm">Alerte #{alert.id}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Score */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${risk.badge}`}>
                Risque {risk.label}
              </span>
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${statusInfo.color}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {statusInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${risk.bar}`} style={{ width: `${alert.score * 100}%` }} />
              </div>
              <span className="text-2xl font-bold text-foreground tabular-nums">{(alert.score * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                Modèle <span className="font-mono">{alert.model_version}</span>
              </p>
              {modelAuc && (
                <p className="text-xs text-muted-foreground">
                  AUC-ROC <span className="font-mono font-semibold">{(modelAuc * 100).toFixed(1)}%</span>
                </p>
              )}
            </div>
          </div>

          {/* Détails */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Détails de la transaction</h3>
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {[
                { icon: Hash,       label: "Transaction ID", value: alert.transaction_id, mono: true },
                { icon: DollarSign, label: "Montant",        value: `${alert.amount.toLocaleString("fr-FR")} ${alert.currency}` },
                { icon: Smartphone, label: "Canal",          value: alert.channel },
                { icon: Globe,      label: "Pays",           value: alert.country },
                { icon: Calendar,   label: "Date",           value: new Date(alert.timestamp).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
              ].map(({ icon: Icon, label, value, mono }) => (
                <div key={label} className="flex items-start justify-between px-4 py-3">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </span>
                  <span className={`text-xs font-medium text-foreground text-right ml-4 break-all ${mono ? "font-mono" : ""}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SHAP Explainability */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Explainabilité IA — SHAP
              </h3>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              {hasShap ? (
                <ShapChart shap_values={shap!} base_value={baseValue} />
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Cpu className="w-3.5 h-3.5 shrink-0" />
                  {alert.explanations?.note === "shap_unavailable"
                    ? "Explications SHAP indisponibles (modèle heuristique)"
                    : "Aucune donnée d'explainabilité pour cette alerte"}
                </div>
              )}
            </div>
          </div>

          {/* Commentaire */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Commentaire (optionnel)
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Ajoutez une note enregistrée dans l'audit log…"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-border px-5 py-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {ACTIONS.filter(a => a.status !== alert.status).map(({ status, label, icon: Icon, style }) => (
              <button
                key={status}
                onClick={() => handleAction(status)}
                disabled={loading !== null}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${style}`}
              >
                {loading === status
                  ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <Icon className="w-3.5 h-3.5" />
                }
                {label}
              </button>
            ))}
          </div>
        </div>

      </aside>
    </>
  );
}
