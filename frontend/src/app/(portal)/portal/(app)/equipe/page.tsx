"use client";

import { useEffect, useState, useCallback } from "react";
import { usePortalAuthStore } from "@/lib/stores/portal-auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { portalFetch } from "@/lib/api/portal-fetch";
import {
  Users, UserPlus, Trash2, Copy, Check, Shield,
  Code2, FileText, User, X, Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  keycloak_id: string;
  username: string;
  email: string;
  enabled: boolean;
  roles: string[];
  tenant_id: number;
  tenant_name: string;
}

interface PagePerm {
  key: string;
  label: string;
  icon: string;
  feature_enabled: boolean;
  perms: Record<string, boolean>;
}

interface InviteForm {
  username: string;
  email: string;
  role: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  tenant_admin: { label: "Admin",        color: "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400", icon: Shield },
  developer:    { label: "Développeur",  color: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",         icon: Code2 },
  compliance:   { label: "Conformité",   color: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",     icon: FileText },
  tenant:       { label: "Opérateur",    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",            icon: User },
};

const ASSIGNABLE_ROLES = ["developer", "compliance", "tenant"] as const;

// ── Composant principal ───────────────────────────────────────────────────────

export default function PortalEquipePage() {
  const { user } = usePortalAuthStore();
  const { activeTenantId } = useAppStore();

  const [tab, setTab] = useState<"membres" | "permissions">("membres");
  const [members, setMembers] = useState<Member[]>([]);
  const [pages, setPages] = useState<PagePerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!activeTenantId) return;
    const res = await portalFetch(`/api/v1/admin/tenants/${activeTenantId}/users`);
    if (res.ok) setMembers(await res.json());
  }, [activeTenantId]);

  const loadPermissions = useCallback(async () => {
    if (!activeTenantId) return;
    const res = await portalFetch(`/api/v1/admin/tenants/${activeTenantId}/permissions`);
    if (res.ok) {
      const data = await res.json();
      setPages(data.pages);
    }
  }, [activeTenantId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadMembers(), loadPermissions()]).finally(() => setLoading(false));
  }, [loadMembers, loadPermissions]);

  const handleTogglePerm = async (pageKey: string, role: string, current: boolean) => {
    if (!tenantId) return;
    await portalFetch(`/api/v1/admin/tenants/${tenantId}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ page_key: pageKey, role, allowed: !current }),
    });
    setPages(prev => prev.map(p =>
      p.key === pageKey ? { ...p, perms: { ...p.perms, [role]: !current } } : p
    ));
  };

  const handleRevoke = async (keycloakId: string, username: string) => {
    if (!confirm(`Révoquer l'accès de ${username} ?`)) return;
    const res = await portalFetch(`/api/v1/admin/users/${keycloakId}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setMembers(prev => prev.filter(m => m.keycloak_id !== keycloakId));
    }
  };

  if (activeTenantId === null) return null;
  const tenantId: number = activeTenantId;

  return (
    <div className="flex-1 overflow-y-auto p-6">

      {/* Tabs */}
      <div className="mt-5 flex gap-1 border-b border-border">
        {(["membres", "permissions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "membres" ? "Membres" : "Permissions"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === "membres" ? (
        <MembresTab
          members={members}
          tenantId={tenantId}
          onInvite={() => setShowInvite(true)}
          onRevoke={handleRevoke}
          currentUserSub={user?.sub}
        />
      ) : (
        <PermissionsTab pages={pages} onToggle={handleTogglePerm} />
      )}

      {showInvite && (
        <InviteModal
          tenantId={tenantId}
          onClose={() => setShowInvite(false)}
          onSuccess={(m) => { setMembers(prev => [...prev, m]); setShowInvite(false); }}
        />
      )}
    </div>
  );
}

// ── Onglet Membres ────────────────────────────────────────────────────────────

function MembresTab({ members, tenantId, onInvite, onRevoke, currentUserSub }: {
  members: Member[];
  tenantId: number;
  onInvite: () => void;
  onRevoke: (id: string, name: string) => void;
  currentUserSub?: string;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{members.length} membre{members.length > 1 ? "s" : ""}</p>
        <button
          onClick={onInvite}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Inviter un membre
        </button>
      </div>

      <div className="space-y-2">
        {members.map((m) => {
          const role = m.roles[0] ?? "tenant";
          const meta = ROLE_META[role] ?? ROLE_META.tenant;
          const Icon = meta.icon;
          const isMe = m.keycloak_id === currentUserSub;
          return (
            <div key={m.keycloak_id} className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {m.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{m.username}</span>
                    {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Vous</span>}
                    {!m.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600">Désactivé</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.email || "—"}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.color}`}>
                  <Icon className="w-3 h-3" />
                  {meta.label}
                </span>
                {!isMe && role !== "tenant_admin" && (
                  <button
                    onClick={() => onRevoke(m.keycloak_id, m.username)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Révoquer l'accès"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="mt-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground">Aucun membre</p>
            <p className="text-sm text-muted-foreground mt-1">Invitez votre équipe pour commencer.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Onglet Permissions ────────────────────────────────────────────────────────

const PERM_ROLES = ["developer", "compliance", "tenant"] as const;

function PermissionsTab({ pages, onToggle }: {
  pages: PagePerm[];
  onToggle: (pageKey: string, role: string, current: boolean) => void;
}) {
  return (
    <div className="mt-5 overflow-x-auto">
      <p className="text-xs text-muted-foreground mb-4">
        Configurez les accès de chaque rôle. Les cases grises sont désactivées par FraudGuard.
      </p>
      <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Page</th>
            {PERM_ROLES.map((r) => (
              <th key={r} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {ROLE_META[r]?.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {pages.map((page) => (
            <tr key={page.key} className="bg-card">
              <td className="px-4 py-3 font-medium text-foreground">{page.label}</td>
              {PERM_ROLES.map((role) => {
                const allowed = page.perms[role] ?? false;
                const featureOff = !page.feature_enabled;
                return (
                  <td key={role} className="px-4 py-3 text-center">
                    <button
                      disabled={featureOff}
                      onClick={() => !featureOff && onToggle(page.key, role, allowed)}
                      className={`w-10 h-6 rounded-full transition-all relative ${
                        featureOff
                          ? "bg-muted cursor-not-allowed opacity-40"
                          : allowed
                          ? "bg-blue-500"
                          : "bg-muted-foreground/30"
                      }`}
                      title={featureOff ? "Désactivé par FraudGuard" : undefined}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                        allowed ? "left-4" : "left-0.5"
                      }`} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Modal d'invitation ────────────────────────────────────────────────────────

function InviteModal({ tenantId, onClose, onSuccess }: {
  tenantId: number;
  onClose: () => void;
  onSuccess: (member: Member) => void;
}) {
  const [form, setForm] = useState<InviteForm>({ username: "", email: "", role: "tenant" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ username: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await portalFetch("/api/v1/admin/users/invite", {
        method: "POST",
        body: JSON.stringify({ ...form, tenant_id: tenantId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Une erreur est survenue");
        return;
      }
      setResult({ username: data.username, password: data.temporary_password ?? "—" });
      onSuccess({
        keycloak_id: data.keycloak_id,
        username: data.username,
        email: data.email,
        enabled: true,
        roles: [data.role],
        tenant_id: tenantId,
        tenant_name: "",
      });
    } catch {
      setError("Erreur de connexion. Vérifiez que l'API est accessible.");
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Identifiant : ${result.username}\nMot de passe : ${result.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Fermer"
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-foreground">Inviter un membre</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3">
                Compte créé — transmettez ces identifiants
              </p>
              <div className="space-y-1.5 font-mono text-xs bg-background rounded-lg p-3 border border-border">
                <p><span className="text-muted-foreground">Identifiant :</span> {result.username}</p>
                <p><span className="text-muted-foreground">Mot de passe :</span> {result.password}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Ces identifiants ne seront plus affichés après fermeture.</p>
            </div>
            <button
              onClick={copyCredentials}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copié !" : "Copier les identifiants"}
            </button>
            <button onClick={onClose} className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Identifiant</label>
              <input
                type="text" required value={form.username}
                onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="ex: jean.dupont"
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email" required value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jean.dupont@entreprise.com"
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Rôle</label>
              <select
                value={form.role}
                onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_META[r]?.label ?? r}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {loading ? "Création…" : "Inviter"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
