"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { formatDate } from "@/lib/utils";
import { Settings, Webhook, Plus, Trash2, X, Check, ToggleLeft, ToggleRight } from "lucide-react";
import type { TenantResponse, PolicyConfig, ScoringHookResponse } from "@/types/api";

// ── Policy form ───────────────────────────────────────────────────────────────
function PolicySection({ tenantId }: { tenantId: number }) {
  const qc = useQueryClient();
  const { data: policy } = useQuery<PolicyConfig>({
    queryKey: ["policy", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/tenants/${tenantId}/policies`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const [form, setForm] = useState<Partial<PolicyConfig>>({});
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { ...policy, ...form };
      const res = await fetch(`/api/v1/tenants/${tenantId}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policy", tenantId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const val = (k: keyof PolicyConfig) => (form[k] ?? policy?.[k] ?? "") as string | number;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Politique de scoring
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Seuil de fraude</label>
            <input type="number" step="0.01" min="0" max="1"
              value={val("score_threshold")}
              onChange={(e) => setForm((f) => ({ ...f, score_threshold: parseFloat(e.target.value) }))}
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <p className="text-[10px] text-muted-foreground mt-1">Score ≥ ce seuil → marqué fraude</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Seuil de rejet auto</label>
            <input type="number" step="0.01" min="0" max="1"
              value={val("auto_reject_threshold")}
              onChange={(e) => setForm((f) => ({ ...f, auto_reject_threshold: parseFloat(e.target.value) }))}
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <p className="text-[10px] text-muted-foreground mt-1">Score ≥ seuil → rejet immédiat</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Montant max (XOF)</label>
            <input type="number"
              value={val("max_amount_xof")}
              onChange={(e) => setForm((f) => ({ ...f, max_amount_xof: parseFloat(e.target.value) }))}
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Modèle ID</label>
            <input value={String(val("model_id"))}
              onChange={(e) => setForm((f) => ({ ...f, model_id: e.target.value }))}
              className="w-full h-9 px-3 text-sm font-mono rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending} variant={saved ? "outline" : "default"}>
          {saved ? <><Check className="w-4 h-4" /> Sauvegardé</> : "Enregistrer la politique"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Hooks section ─────────────────────────────────────────────────────────────
function HookRow({ hook, tenantId, onDeleted }: { hook: ScoringHookResponse; tenantId: number; onDeleted: () => void }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/tenants/${tenantId}/hooks/${hook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...hook, enabled: !hook.enabled }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hooks", tenantId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/v1/tenants/${tenantId}/hooks/${hook.id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => { onDeleted(); qc.invalidateQueries({ queryKey: ["hooks", tenantId] }); },
  });

  return (
    <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
      <td className="px-5 py-3 text-sm font-medium text-foreground">{hook.name}</td>
      <td className="px-5 py-3">
        <Badge variant={hook.hook_type === "pre_score" ? "default" : "secondary"}>
          {hook.hook_type}
        </Badge>
      </td>
      <td className="px-5 py-3 text-xs font-mono text-muted-foreground truncate max-w-48">{hook.url}</td>
      <td className="px-5 py-3 text-xs text-muted-foreground">{hook.timeout_ms ?? 3000}ms</td>
      <td className="px-5 py-3">
        <button onClick={() => toggleMutation.mutate()} className="text-muted-foreground hover:text-foreground">
          {hook.enabled
            ? <ToggleRight className="w-5 h-5 text-green-500" />
            : <ToggleLeft className="w-5 h-5" />}
        </button>
      </td>
      <td className="px-5 py-3">
        {confirm ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate()} loading={deleteMutation.isPending}>
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirm(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirm(true)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </td>
    </tr>
  );
}

function HooksSection({ tenantId }: { tenantId: number }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [hookForm, setHookForm] = useState({ name: "", hook_type: "pre_score", url: "", secret: "", timeout_ms: 3000 });

  const { data: hooks = [] } = useQuery<ScoringHookResponse[]>({
    queryKey: ["hooks", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/tenants/${tenantId}/hooks`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/tenants/${tenantId}/hooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...hookForm, enabled: true }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hooks", tenantId] }); setShowForm(false); },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Webhook className="w-4 h-4" />
          Scoring Hooks
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-3.5 h-3.5" />
          Ajouter
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Nouveau hook</p>
            <div className="grid grid-cols-2 gap-3">
              <input value={hookForm.name} onChange={(e) => setHookForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nom du hook"
                className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <select value={hookForm.hook_type} onChange={(e) => setHookForm((f) => ({ ...f, hook_type: e.target.value }))}
                className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="pre_score">pre_score</option>
                <option value="post_score">post_score</option>
              </select>
              <input value={hookForm.url} onChange={(e) => setHookForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://… URL endpoint"
                className="col-span-2 h-9 px-3 text-sm font-mono rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <input value={hookForm.secret} onChange={(e) => setHookForm((f) => ({ ...f, secret: e.target.value }))}
                placeholder="Secret HMAC (optionnel)"
                className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <input type="number" value={hookForm.timeout_ms} onChange={(e) => setHookForm((f) => ({ ...f, timeout_ms: parseInt(e.target.value) }))}
                placeholder="Timeout ms"
                className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Créer</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
            </div>
          </div>
        )}

        {hooks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aucun hook configuré.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Nom", "Type", "URL", "Timeout", "Actif", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hooks.map((h) => (
                  <HookRow key={h.id} hook={h} tenantId={tenantId} onDeleted={() => {}} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MonTenantPage() {
  const { user } = useAuthStore();
  const { activeTenantId } = useAppStore();

  const { data: tenant } = useQuery<TenantResponse>({
    queryKey: ["my-tenant", activeTenantId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/tenants/${activeTenantId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Mon entreprise" subtitle={tenant?.name ?? "Paramètres du tenant"} />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Tenant info */}
        {tenant && (
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Nom",           value: tenant.name },
                  { label: "Pays",          value: tenant.country },
                  { label: "Environnement", value: tenant.environment },
                  { label: "Créé le",       value: formatDate(tenant.created_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-lg bg-muted/40 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-sm font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <PolicySection tenantId={activeTenantId} />
        <HooksSection tenantId={activeTenantId} />

      </div>
    </div>
  );
}
