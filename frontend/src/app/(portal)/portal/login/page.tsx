"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Eye, EyeOff, Lock } from "lucide-react";
import { usePortalAuthStore } from "@/lib/stores/portal-auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import type { UserInfo, UserRole } from "@/lib/stores/portal-auth.store";

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1];
    const pad = part + "=".repeat((4 - (part.length % 4)) % 4);
    return JSON.parse(atob(pad));
  } catch { return {}; }
}

export default function PortalLoginPage() {
  const router = useRouter();
  const setUser = usePortalAuthStore((s) => s.setUser);
  const setActiveTenantId = useAppStore((s) => s.setActiveTenantId);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Identifiants incorrects");
        return;
      }

      const payload = decodeJwt(data.access_token);
      const roles = ((payload as any).realm_access?.roles ?? []) as UserRole[];

      // Ce portail est réservé aux opérateurs clients (tenant, compliance)
      const allowedRoles = new Set<UserRole>(["tenant", "compliance", "tenant_admin", "developer"]);
      const hasPortalRole = roles.some((r) => allowedRoles.has(r));
      if (!hasPortalRole) {
        setError("Ce portail est réservé aux opérateurs clients. Utilisez l'espace FraudGuard.");
        return;
      }

      const userInfo: UserInfo = {
        sub:      payload.sub as string,
        username: (payload.preferred_username as string) || username,
        email:    (payload.email as string) || "",
        roles,
        tenantId: undefined,
      };
      setUser(userInfo, data.access_token, data.refresh_token);

      // Résoudre le tenant — bloquant : sans tenant résolu on ne rentre pas dans le portail
      const tenantRes = await fetch("/api/v1/my-tenant", {
        headers: { "Authorization": `Bearer ${data.access_token}` },
      });
      if (!tenantRes.ok) {
        setError("Impossible de résoudre votre organisation. Contactez votre administrateur.");
        return;
      }
      const tenantData = await tenantRes.json();
      setActiveTenantId(tenantData.id);

      router.push("/portal");
    } catch {
      setError("Erreur de connexion. Vérifiez que l'API est accessible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">FraudGuard</h1>
          <p className="text-sm text-muted-foreground mt-1">Espace Client</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl border border-border shadow-card p-6">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-foreground">Connexion</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Accédez à votre espace de suivi des transactions
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Identifiant</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: operateur-orange"
                required
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-9 px-3 pr-9 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {loading ? "Connexion en cours…" : "Se connecter"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4 space-y-2">
          <div className="flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Authentification sécurisée via Keycloak</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Équipe FraudGuard ?{" "}
            <a href="/login" className="text-blue-600 hover:underline font-medium">
              Espace administration →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
