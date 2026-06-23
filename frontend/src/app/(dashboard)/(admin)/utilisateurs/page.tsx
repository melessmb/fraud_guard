"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, UserPlus, Trash2, ShieldCheck, Mail, Eye, EyeOff,
  Lock, LayoutDashboard, AlertTriangle, BarChart2, Zap, FileText, ArrowLeftRight, Download,
} from "lucide-react";

interface UserOut {
  keycloak_id: string;
  username: string;
  email: string;
  enabled: boolean;
  roles: string[];
  tenant_id: number;
  tenant_name: string;
}

interface Tenant { id: number; name: string; }

interface PermPage {
  key: string;
  label: string;
  icon: string;
  perms: Record<string, boolean>;
}

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: "Admin tenant",
  compliance:   "Compliance",
  tenant:       "Utilisateur",
};

const ROLE_COLORS: Record<string, string> = {
  admin:        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  tenant_admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  compliance:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  tenant:       "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const PAGE_ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, AlertTriangle, BarChart2, Zap, FileText, ArrowLeftRight, Download,
};

// ── Invite modal ──────────────────────────────────────────────────────────────
function InviteModal({ tenants, onClose, onSuccess }: {
  tenants: Tenant[];
  onClose: () => void;
  onSuccess: (password: string, username: string) => void;
}) {
  const [form, setForm] = useState({ username: "", email: "", role: "tenant", tenant_id: tenants[0]?.id ?? 0 });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/v1/admin/users/invite", {
        method: "POST",
        body: JSON.stringify({ ...form, tenant_id: Number(form.tenant_id) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || `Erreur ${res.status}`); }
      return res.json();
    },
    onSuccess: (data) => onSuccess(data.temporary_password, data.username),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4 text-primary" />Inviter un utilisateur</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5">Identifiant</label>
            <input type="text" required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="ex : jean.dupont"
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Email</label>
            <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="jean.dupont@exemple.com"
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">Rôle</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="tenant">Utilisateur</option>
                <option value="tenant_admin">Admin tenant</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Tenant</label>
              <select value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: Number(e.target.value) }))}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending}><UserPlus className="w-3.5 h-3.5" />Inviter</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Password modal ────────────────────────────────────────────────────────────
function SuccessModal({ username, password, onClose }: { username: string; password: string; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-green-600"><ShieldCheck className="w-5 h-5" /><h2 className="font-semibold">Utilisateur créé</h2></div>
        <p className="text-sm text-muted-foreground">Communiquez ces identifiants à <strong>{username}</strong> — le mot de passe est temporaire.</p>
        <div className="bg-muted rounded-lg px-4 py-3 font-mono text-sm space-y-1">
          <div>Identifiant : <strong>{username}</strong></div>
          <div className="flex items-center gap-2">
            Mot de passe : <strong>{visible ? password : "••••••••••••"}</strong>
            <button onClick={() => setVisible(v => !v)} className="text-muted-foreground">
              {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <Button className="w-full" onClick={onClose}>Fermer</Button>
      </div>
    </div>
  );
}

// ── Permissions grid ──────────────────────────────────────────────────────────
function PermissionsGrid({ tenantId }: { tenantId: number }) {
  const qc = useQueryClient();
  const ROLES = ["tenant_admin", "compliance", "tenant"];

  const { data, isLoading } = useQuery<{ pages: PermPage[] }>({
    queryKey: ["permissions", tenantId],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/admin/tenants/${tenantId}/permissions`);
      if (!res.ok) throw new Error("Erreur chargement permissions");
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

  if (isLoading) return <div className="text-center py-8 text-sm text-muted-foreground">Chargement…</div>;
  if (!data) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Page</th>
            {ROLES.map(r => (
              <th key={r} className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {ROLE_LABELS[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.pages.map(page => {
            const Icon = PAGE_ICONS[page.icon] ?? Lock;
            return (
              <tr key={page.key} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-foreground text-sm">{page.label}</span>
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
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function UtilisateursPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"users" | "permissions">("users");
  const [showInvite, setShowInvite] = useState(false);
  const [success, setSuccess] = useState<{ username: string; password: string } | null>(null);
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [permTenantId, setPermTenantId] = useState<number>(0);

  const { data: users = [], isLoading } = useQuery<UserOut[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/admin/users");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["tenants"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/tenants");
      if (!res.ok) return [];
      const data = await res.json();
      if (data.length > 0 && permTenantId === 0) setPermTenantId(data[0].id);
      return data;
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (kid: string) => {
      await apiFetch(`/api/v1/admin/users/${kid}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const filtered = filterTenant === "all" ? users : users.filter(u => String(u.tenant_id) === filterTenant);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Utilisateurs & Permissions" subtitle="Gestion des accès et des droits par tenant" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Tabs */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-1 w-fit">
          {(["users", "permissions"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}>
              {t === "users" ? <><Users className="w-3.5 h-3.5 inline mr-1.5" />Utilisateurs</> : <><Lock className="w-3.5 h-3.5 inline mr-1.5" />Permissions</>}
            </button>
          ))}
        </div>

        {/* ── Onglet Utilisateurs ── */}
        {tab === "users" && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)}
                  className="h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="all">Tous les tenants</option>
                  {tenants.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">{filtered.length} utilisateur{filtered.length > 1 ? "s" : ""}</span>
              </div>
              <Button onClick={() => setShowInvite(true)}><UserPlus className="w-3.5 h-3.5" />Inviter un utilisateur</Button>
            </div>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" />Utilisateurs</CardTitle></CardHeader>
              <CardContent className="px-0 pb-0">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Chargement…</div>
                ) : filtered.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Aucun utilisateur</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Utilisateur", "Email", "Tenant", "Rôles", "Statut", ""].map(h => (
                          <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(user => (
                        <tr key={user.keycloak_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                {user.username.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="font-medium text-foreground">{user.username}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{user.email || "—"}</div>
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">{user.tenant_name}</td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {user.roles.map(r => (
                                <span key={r} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[r] ?? "bg-muted text-muted-foreground"}`}>{r}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-3"><Badge variant={user.enabled ? "success" : "secondary"}>{user.enabled ? "Actif" : "Désactivé"}</Badge></td>
                          <td className="px-5 py-3">
                            {user.enabled && (
                              <button onClick={() => { if (confirm(`Révoquer ${user.username} ?`)) revokeMutation.mutate(user.keycloak_id); }}
                                className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Onglet Permissions ── */}
        {tab === "permissions" && (
          <Card>
            <CardHeader className="flex-row items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2"><Lock className="w-4 h-4" />Permissions par page</CardTitle>
              <select
                value={permTenantId}
                onChange={e => setPermTenantId(Number(e.target.value))}
                className="h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <PermissionsGrid tenantId={permTenantId} />
            </CardContent>
          </Card>
        )}
      </div>

      {showInvite && (
        <InviteModal tenants={tenants} onClose={() => setShowInvite(false)}
          onSuccess={(password, username) => { setShowInvite(false); setSuccess({ username, password }); qc.invalidateQueries({ queryKey: ["admin-users"] }); }} />
      )}
      {success && <SuccessModal username={success.username} password={success.password} onClose={() => setSuccess(null)} />}
    </div>
  );
}
