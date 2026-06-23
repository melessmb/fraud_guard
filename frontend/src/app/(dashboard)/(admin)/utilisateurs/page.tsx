"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, Trash2, ShieldCheck, Mail, Eye, EyeOff } from "lucide-react";

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

const ROLE_COLORS: Record<string, string> = {
  admin:        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  tenant_admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  compliance:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  tenant:       "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function InviteModal({ tenants, onClose, onSuccess }: {
  tenants: Tenant[];
  onClose: () => void;
  onSuccess: (password: string, username: string) => void;
}) {
  const [form, setForm] = useState({ username: "", email: "", role: "tenant", tenant_id: tenants[0]?.id ?? 0 });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/v1/admin/users/invite", {
        method: "POST",
        body: JSON.stringify({ ...form, tenant_id: Number(form.tenant_id) }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || `Erreur ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (data) => onSuccess(data.temporary_password, data.username),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Inviter un utilisateur
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Identifiant</label>
            <input type="text" required value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="ex : jean.dupont"
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Email</label>
            <input type="email" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="jean.dupont@exemple.com"
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Rôle</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="tenant">Utilisateur</option>
                <option value="tenant_admin">Admin tenant</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Tenant</label>
              <select value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: Number(e.target.value) }))}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
              <UserPlus className="w-3.5 h-3.5" />
              Inviter
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ username, password, onClose }: { username: string; password: string; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <ShieldCheck className="w-5 h-5" />
          <h2 className="font-semibold">Utilisateur créé</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Communiquez ces identifiants à <strong>{username}</strong> — le mot de passe est temporaire.
        </p>
        <div className="bg-muted rounded-lg px-4 py-3 font-mono text-sm space-y-1">
          <div>Identifiant : <strong>{username}</strong></div>
          <div className="flex items-center gap-2">
            Mot de passe : <strong>{visible ? password : "••••••••••••"}</strong>
            <button onClick={() => setVisible(v => !v)} className="text-muted-foreground hover:text-foreground">
              {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <Button className="w-full" onClick={onClose}>Fermer</Button>
      </div>
    </div>
  );
}

export default function UtilisateursPage() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [success, setSuccess] = useState<{ username: string; password: string } | null>(null);
  const [filterTenant, setFilterTenant] = useState<string>("all");

  const { data: users = [], isLoading } = useQuery<UserOut[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/admin/users");
      if (!res.ok) throw new Error("Erreur chargement utilisateurs");
      return res.json();
    },
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["tenants"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/tenants");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (keycloakId: string) => {
      const res = await apiFetch(`/api/v1/admin/users/${keycloakId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Erreur révocation");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const filtered = filterTenant === "all" ? users : users.filter(u => String(u.tenant_id) === filterTenant);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Gestion des utilisateurs" subtitle="Inviter, gérer les accès et les permissions" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Header actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="all">Tous les tenants</option>
              {tenants.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">{filtered.length} utilisateur{filtered.length > 1 ? "s" : ""}</span>
          </div>
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="w-3.5 h-3.5" />
            Inviter un utilisateur
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Utilisateurs
            </CardTitle>
          </CardHeader>
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
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Mail className="w-3 h-3" />
                          {user.email || "—"}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{user.tenant_name}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map(r => (
                            <span key={r} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[r] ?? "bg-muted text-muted-foreground"}`}>
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={user.enabled ? "success" : "secondary"}>
                          {user.enabled ? "Actif" : "Désactivé"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        {user.enabled && (
                          <button
                            onClick={() => { if (confirm(`Révoquer l'accès de ${user.username} ?`)) revokeMutation.mutate(user.keycloak_id); }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Révoquer l'accès"
                          >
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
      </div>

      {showInvite && (
        <InviteModal
          tenants={tenants}
          onClose={() => setShowInvite(false)}
          onSuccess={(password, username) => {
            setShowInvite(false);
            setSuccess({ username, password });
            qc.invalidateQueries({ queryKey: ["admin-users"] });
          }}
        />
      )}

      {success && (
        <SuccessModal
          username={success.username}
          password={success.password}
          onClose={() => setSuccess(null)}
        />
      )}
    </div>
  );
}
