"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/fetch";
import {
  X, ShieldAlert, CheckCircle, Clock, XCircle,
  Hash, DollarSign, Smartphone, Globe, Cpu, Calendar,
} from "lucide-react";

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
}

interface Props {
  alert: AlertDetail | null;
  onClose: () => void;
  onStatusChange: (updated: AlertDetail) => void;
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

export function AlertDrawer({ alert, onClose, onStatusChange }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  if (!alert) return null;

  const risk = RISK_STYLE[alert.risk_level] ?? RISK_STYLE.high;
  const statusInfo = STATUS_META[alert.status] ?? STATUS_META.open;
  const StatusIcon = statusInfo.icon;

  const handleAction = async (newStatus: string) => {
    setLoading(newStatus);
    setError("");
    try {
      const res = await apiFetch(`/api/v1/tenants/${alert.tenant_id}/alerts/${alert.id}`, {
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
            <p className="text-xs text-muted-foreground mt-2">
              Score calculé par le modèle <span className="font-mono">{alert.model_version}</span>
            </p>
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
