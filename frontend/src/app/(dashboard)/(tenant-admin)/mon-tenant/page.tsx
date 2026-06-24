"use client";

import { apiFetch } from "@/lib/api/fetch";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { formatDate } from "@/lib/utils";
import { Settings, Webhook, Plus, Trash2, X, Check, ToggleLeft, ToggleRight, Key, Copy, AlertTriangle, RefreshCw, ShieldOff, Users, UserPlus, Mail, Eye, EyeOff, ShieldCheck, Lock, LayoutDashboard, BarChart2, Zap, FileText, ArrowLeftRight, Download } from "lucide-react";
import type { TenantResponse, PolicyConfig, ScoringHookResponse } from "@/types/api";

// ── API Key section ───────────────────────────────────────────────────────────
function ApiKeySection({ tenantId }: { tenantId: number }) {
  const qc = useQueryClient();
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const { data: status } = useQuery<{ has_key: boolean }>({
    queryKey: ["api-key-status", tenantId],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/tenants/${tenantId}/api-key/status`);
      if (!res.ok) return { has_key: false };
      return res.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/tenants/${tenantId}/api-key`, { method: "POST" });
      if (!res.ok) throw new Error("Erreur lors de la génération");
      return res.json() as Promise<{ api_key: string }>;
    },
    onSuccess: (data) => {
      setPlainKey(data.api_key);
      qc.invalidateQueries({ queryKey: ["api-key-status", tenantId] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/tenants/${tenantId}/api-key`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la révocation");
    },
    onSuccess: () => {
      setPlainKey(null);
      setConfirmRevoke(false);
      qc.invalidateQueries({ queryKey: ["api-key-status", tenantId] });
    },
  });

  const copyKey = async () => {
    if (!plainKey) return;
    await navigator.clipboard.writeText(plainKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasKey = status?.has_key ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="w-4 h-4" />
          API Key
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Status badge */}
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${hasKey ? "bg-green-500" : "bg-muted-foreground"}`} />
          <span className="text-sm text-foreground font-medium">
            {hasKey ? "Clé active" : "Aucune clé configurée"}
          </span>
          {hasKey && (
            <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
              fg_••••••••••••••••
            </span>
          )}
        </div>

        {/* Revealed key (shown only once after generation) */}
        {plainKey && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p className="text-xs font-semibold">Copiez cette clé maintenant — elle ne sera plus affichée</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-background border border-border rounded-lg px-3 py-2 break-all text-foreground">
                {plainKey}
              </code>
              <button onClick={copyKey}
                className={`shrink-0 p-2 rounded-lg border transition-colors ${copied ? "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-600" : "border-border hover:bg-accent text-muted-foreground"}`}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-amber-600 dark:text-amber-500">
              Utilisez cette clé dans le header <code className="font-mono">X-API-Key: &lt;clé&gt;</code> ou en tant que token Bearer.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            size="sm"
            variant={hasKey ? "outline" : "default"}
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || revokeMutation.isPending}
          >
            {generateMutation.isPending
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />}
            {hasKey ? "Regénérer" : "Générer une clé"}
          </Button>

          {hasKey && !confirmRevoke && (
            <Button size="sm" variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmRevoke(true)}>
              <ShieldOff className="w-3.5 h-3.5" />
              Révoquer
            </Button>
          )}

          {confirmRevoke && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confirmer la révocation ?</span>
              <Button size="sm" variant="ghost"
                className="text-destructive hover:bg-destructive/10 h-7 px-2"
                onClick={() => revokeMutation.mutate()}
                disabled={revokeMutation.isPending}>
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setConfirmRevoke(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {(generateMutation.error || revokeMutation.error) && (
          <p className="text-xs text-destructive">
            {(generateMutation.error as Error)?.message ?? (revokeMutation.error as Error)?.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Users section ─────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  tenant_admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  compliance:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  tenant:       "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

interface UserOut { keycloak_id: string; username: string; email: string; enabled: boolean; roles: string[]; }

function UsersSection({ tenantId }: { tenantId: number }) {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ username: "", email: "", role: "tenant" });
  const [inviteError, setInviteError] = useState("");
  const [success, setSuccess] = useState<{ username: string; password: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const { data: users = [], isLoading } = useQuery<UserOut[]>({
    queryKey: ["tenant-users", tenantId],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/admin/tenants/${tenantId}/users`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/v1/admin/users/invite", {
        method: "POST",
        body: JSON.stringify({ ...inviteForm, tenant_id: tenantId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || `Erreur ${res.status}`); }
      return res.json();
    },
    onSuccess: (data) => {
      setShowInvite(false);
      setInviteForm({ username: "", email: "", role: "tenant" });
      setSuccess({ username: data.username, password: data.temporary_password });
      qc.invalidateQueries({ queryKey: ["tenant-users", tenantId] });
    },
    onError: (e: Error) => setInviteError(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (kid: string) => apiFetch(`/api/v1/admin/users/${kid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-users", tenantId] }),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" />Utilisateurs du tenant</CardTitle>
        <Button size="sm" onClick={() => { setShowInvite(v => !v); setInviteError(""); }}>
          <UserPlus className="w-3.5 h-3.5" />Inviter
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Invite form */}
        {showInvite && (
          <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="text" placeholder="Identifiant" value={inviteForm.username}
                onChange={e => setInviteForm(f => ({ ...f, username: e.target.value }))}
                className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <input type="email" placeholder="Email" value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="tenant">Utilisateur</option>
                <option value="tenant_admin">Admin tenant</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => inviteMutation.mutate()} loading={inviteMutation.isPending}>Envoyer l&apos;invitation</Button>
              <Button size="sm" variant="outline" onClick={() => setShowInvite(false)}>Annuler</Button>
            </div>
          </div>
        )}

        {/* Success banner */}
        {success && (
          <div className="border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" />Utilisateur créé — communiquez ces identifiants temporaires
            </div>
            <div className="font-mono text-sm space-y-0.5">
              <div>Identifiant : <strong>{success.username}</strong></div>
              <div className="flex items-center gap-2">
                Mot de passe : <strong>{showPwd ? success.password : "••••••••••••"}</strong>
                <button onClick={() => setShowPwd(v => !v)} className="text-muted-foreground">
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <button onClick={() => setSuccess(null)} className="text-xs text-muted-foreground hover:text-foreground">Fermer</button>
          </div>
        )}

        {/* Users list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Chargement…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun utilisateur associé à ce tenant.</p>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.keycloak_id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {u.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{u.username}</div>
                  {u.email && <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</div>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.roles.filter(r => r !== "default-roles-fraudguard" && r !== "offline_access" && r !== "uma_authorization").map(r => (
                    <span key={r} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[r] ?? "bg-muted text-muted-foreground"}`}>{r}</span>
                  ))}
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${u.enabled ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {u.enabled ? "Actif" : "Désactivé"}
                </span>
                {u.enabled && (
                  <button onClick={() => { if (confirm(`Révoquer ${u.username} ?`)) revokeMutation.mutate(u.keycloak_id); }}
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Policy form ───────────────────────────────────────────────────────────────
function PolicySection({ tenantId }: { tenantId: number }) {
  const qc = useQueryClient();
  const { data: policy } = useQuery<PolicyConfig>({
    queryKey: ["policy", tenantId],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/tenants/${tenantId}/policies`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const [form, setForm] = useState<Partial<PolicyConfig>>({});
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { ...policy, ...form };
      const res = await apiFetch(`/api/v1/tenants/${tenantId}/policies`, {
        method: "POST",
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
      const res = await apiFetch(`/api/v1/tenants/${tenantId}/hooks/${hook.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...hook, enabled: !hook.enabled }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hooks", tenantId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`/api/v1/tenants/${tenantId}/hooks/${hook.id}`, { method: "DELETE" });
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
      const res = await apiFetch(`/api/v1/tenants/${tenantId}/hooks`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/v1/tenants/${tenantId}/hooks`, {
        method: "POST",
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

// ── Permissions section ────────────────────────────────────────────────────────
const PAGE_ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, AlertTriangle, BarChart2, Zap, FileText, ArrowLeftRight, Download,
};

const ROLE_LABELS_PERM: Record<string, string> = {
  tenant_admin: "Admin tenant",
  compliance:   "Compliance",
  tenant:       "Utilisateur",
};

interface PermPage { key: string; label: string; icon: string; perms: Record<string, boolean>; }

function PermissionsSection({ tenantId }: { tenantId: number }) {
  const qc = useQueryClient();
  const ROLES = ["tenant_admin", "compliance", "tenant"];

  const { data, isLoading } = useQuery<{ pages: PermPage[] }>({
    queryKey: ["permissions", tenantId],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/admin/tenants/${tenantId}/permissions`);
      if (!res.ok) throw new Error("Erreur permissions");
      return res.json();
    },
    enabled: tenantId > 0,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ page_key, role, allowed }: { page_key: string; role: string; allowed: boolean }) => {
      const res = await apiFetch(`/api/v1/admin/tenants/${tenantId}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ page_key, role, allowed }),
      });
      if (!res.ok && res.status !== 204) throw new Error("Erreur");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["permissions", tenantId] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Lock className="w-4 h-4" />Permissions des pages</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">Contrôlez quelles pages chaque rôle peut consulter dans ce tenant.</p>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Chargement…</div>
        ) : !data ? null : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Page</th>
                  {ROLES.map(r => (
                    <th key={r} className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {ROLE_LABELS_PERM[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.pages.map(page => {
                  const Icon = PAGE_ICON_MAP[page.icon] ?? Lock;
                  return (
                    <tr key={page.key} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{page.label}</span>
                        </div>
                      </td>
                      {ROLES.map(role => {
                        const allowed = page.perms[role] ?? true;
                        return (
                          <td key={role} className="px-5 py-3 text-center">
                            <button
                              onClick={() => toggleMutation.mutate({ page_key: page.key, role, allowed: !allowed })}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
                                allowed ? "bg-green-500" : "bg-muted-foreground/30"
                              }`}
                              title={allowed ? "Accès autorisé — cliquer pour bloquer" : "Accès bloqué — cliquer pour autoriser"}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                allowed ? "translate-x-4" : "translate-x-1"
                              }`} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground px-5 py-3">
              <Lock className="w-3 h-3 inline mr-1" />
              Les rôles <strong>admin</strong> et <strong>tenant_admin</strong> ont toujours accès à toutes leurs pages.
            </p>
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
    enabled: activeTenantId !== null,
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/tenants/${activeTenantId}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (activeTenantId === null) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar title="Mon entreprise" subtitle="Chargement…" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Résolution du tenant en cours…</p>
        </div>
      </div>
    );
  }

  const tenantId: number = activeTenantId;

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

        <ApiKeySection tenantId={tenantId} />
        <UsersSection tenantId={tenantId} />
        <PermissionsSection tenantId={tenantId} />
        <PolicySection tenantId={tenantId} />
        <HooksSection tenantId={tenantId} />

      </div>
    </div>
  );
}
