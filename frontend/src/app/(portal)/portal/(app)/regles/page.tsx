"use client";

import { useState, useEffect, useCallback } from "react";
import { portalFetch } from "@/lib/api/portal-fetch";
import { useAppStore } from "@/lib/stores/app.store";
import { useToast } from "@/lib/stores/toast.store";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ShieldBan, Eye, Flag, Loader2 } from "lucide-react";

const CHANNELS = ["mobile_money", "web", "pos", "atm", "ussd"];
const COUNTRIES = ["CI", "SN", "GH", "BJ", "ML", "BF", "TG", "GN"];

const ACTION_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  block:  { label: "Bloquer",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",    icon: ShieldBan },
  review: { label: "Révision", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Eye },
  flag:   { label: "Signaler", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Flag },
};

interface Rule {
  id: number;
  name: string;
  description: string | null;
  min_amount: number | null;
  max_amount: number | null;
  channels: string[] | null;
  countries: string[] | null;
  min_score: number | null;
  max_score: number | null;
  action: string;
  priority: number;
  is_active: boolean;
}

const emptyForm = (): Omit<Rule, "id"> => ({
  name: "", description: "",
  min_amount: null, max_amount: null,
  channels: null, countries: null,
  min_score: null, max_score: null,
  action: "flag", priority: 100, is_active: true,
});

// ── Modal de création/édition ─────────────────────────────────────────────────

function RuleModal({
  initial, onSave, onClose,
}: {
  initial: Omit<Rule, "id"> | Rule;
  onSave: (data: Omit<Rule, "id">) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<Rule, "id">>({ ...initial });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const toggleList = (field: "channels" | "countries", val: string) => {
    const current = form[field] ?? [];
    const next = current.includes(val) ? current.filter(x => x !== val) : [...current, val];
    set(field, next.length ? next : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {"id" in initial ? "Modifier la règle" : "Nouvelle règle"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Nom *</label>
            <input required value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="ex : Bloquer les gros montants hors-CI"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Description</label>
            <textarea value={form.description ?? ""} onChange={e => set("description", e.target.value || null)}
              rows={2} placeholder="Optionnel — contexte de la règle"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Montant */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Montant (XOF)</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" value={form.min_amount ?? ""}
                onChange={e => set("min_amount", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Min (≥)"
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" min="0" value={form.max_amount ?? ""}
                onChange={e => set("max_amount", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Max (≤)"
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Score */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Score ML (0–1)</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" max="1" step="0.01" value={form.min_score ?? ""}
                onChange={e => set("min_score", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Min (≥)"
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" min="0" max="1" step="0.01" value={form.max_score ?? ""}
                onChange={e => set("max_score", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Max (≤)"
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Canaux */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Canaux ciblés <span className="text-muted-foreground">(vide = tous)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map(c => (
                <button key={c} type="button"
                  onClick={() => toggleList("channels", c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    (form.channels ?? []).includes(c)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Pays */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Pays ciblés <span className="text-muted-foreground">(vide = tous)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map(c => (
                <button key={c} type="button"
                  onClick={() => toggleList("countries", c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    (form.countries ?? []).includes(c)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Action & priorité */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Action</label>
              <select value={form.action} onChange={e => set("action", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="flag">Signaler</option>
                <option value="review">Marquer pour révision</option>
                <option value="block">Bloquer (score → 1.0)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Priorité (1 = haute)</label>
              <input type="number" min="1" max="1000" value={form.priority}
                onChange={e => set("priority", parseInt(e.target.value) || 100)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {"id" in initial ? "Mettre à jour" : "Créer la règle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function PortalReglesPage() {
  const { activeTenantId } = useAppStore();
  const toast = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; rule?: Rule } | null>(null);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true);
    try {
      const res = await portalFetch(`/api/v1/tenants/${activeTenantId}/rules`);
      if (res.ok) setRules(await res.json());
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: Omit<Rule, "id">) => {
    if (!activeTenantId) return;
    const isEdit = modal?.mode === "edit" && modal.rule;
    const url = isEdit
      ? `/api/v1/tenants/${activeTenantId}/rules/${modal.rule!.id}`
      : `/api/v1/tenants/${activeTenantId}/rules`;
    const res = await portalFetch(url, {
      method: isEdit ? "PUT" : "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.detail || "Erreur lors de la sauvegarde");
      return;
    }
    toast.success(isEdit ? "Règle mise à jour" : "Règle créée");
    setModal(null);
    load();
  };

  const handleToggle = async (rule: Rule) => {
    if (!activeTenantId) return;
    const res = await portalFetch(`/api/v1/tenants/${activeTenantId}/rules/${rule.id}`, {
      method: "PUT",
      body: JSON.stringify({ is_active: !rule.is_active }),
    });
    if (res.ok) {
      setRules(r => r.map(x => x.id === rule.id ? { ...x, is_active: !rule.is_active } : x));
    }
  };

  const handleDelete = async (rule: Rule) => {
    if (!activeTenantId) return;
    if (!confirm(`Supprimer la règle "${rule.name}" ?`)) return;
    const res = await portalFetch(`/api/v1/tenants/${activeTenantId}/rules/${rule.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Règle supprimée");
      setRules(r => r.filter(x => x.id !== rule.id));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-muted-foreground">
          {rules.length} règle{rules.length !== 1 ? "s" : ""} · appliquées après le scoring ML, par ordre de priorité
        </p>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Nouvelle règle
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Flag className="w-6 h-6 opacity-40" />
          </div>
          <p className="text-sm font-medium">Aucune règle personnalisée</p>
          <p className="text-xs text-muted-foreground/70 text-center max-w-xs">
            Créez des règles pour bloquer, mettre en révision ou signaler des transactions selon vos critères métier.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => {
            const { label, color, icon: Icon } = ACTION_META[rule.action] ?? ACTION_META.flag;
            return (
              <div key={rule.id}
                className={`bg-card border rounded-xl p-4 flex items-start gap-4 transition-opacity ${!rule.is_active ? "opacity-50" : ""}`}>

                {/* Toggle */}
                <button onClick={() => handleToggle(rule)} className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  {rule.is_active
                    ? <ToggleRight className="w-5 h-5 text-blue-500" />
                    : <ToggleLeft className="w-5 h-5" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground truncate">{rule.name}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
                      <Icon className="w-3 h-3" /> {label}
                    </span>
                    <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                      P{rule.priority}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground mb-1.5">{rule.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {(rule.min_amount != null || rule.max_amount != null) && (
                      <span>Montant : {rule.min_amount != null ? `≥ ${rule.min_amount.toLocaleString()}` : ""}{rule.min_amount != null && rule.max_amount != null ? " et " : ""}{rule.max_amount != null ? `≤ ${rule.max_amount.toLocaleString()}` : ""}</span>
                    )}
                    {(rule.min_score != null || rule.max_score != null) && (
                      <span>Score : {rule.min_score != null ? `≥ ${(rule.min_score * 100).toFixed(0)}%` : ""}{rule.min_score != null && rule.max_score != null ? "–" : ""}{rule.max_score != null ? `≤ ${(rule.max_score * 100).toFixed(0)}%` : ""}</span>
                    )}
                    {rule.channels?.length && <span>Canaux : {rule.channels.join(", ")}</span>}
                    {rule.countries?.length && <span>Pays : {rule.countries.join(", ")}</span>}
                    {!rule.min_amount && !rule.max_amount && !rule.min_score && !rule.max_score && !rule.channels && !rule.countries && (
                      <span className="text-yellow-600 dark:text-yellow-400">⚠ Aucune condition — s'applique à toutes les transactions</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setModal({ mode: "edit", rule })}
                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(rule)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <RuleModal
          initial={modal.mode === "edit" && modal.rule ? modal.rule : emptyForm()}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
