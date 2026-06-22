"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { User, Shield, Sun, Moon, Globe, Check } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin:        "Administrateur Plateforme",
  tenant_admin: "Administrateur Tenant",
  compliance:   "Responsable Conformité",
  tenant:       "Tenant API",
};

const ROLE_COLORS: Record<string, string> = {
  admin:        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  tenant_admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  compliance:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  tenant:       "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export default function ProfilPage() {
  const { user, primaryRole } = useAuthStore();
  const { theme, setTheme, locale, setLocale } = useAppStore();
  const [saved, setSaved] = useState(false);
  const role = primaryRole();

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!user) return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Profil" />
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Chargement...</div>
    </div>
  );

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Profil" subtitle="Gérez vos informations et préférences" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-2xl">

        {/* Avatar + identity */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold shadow-sm">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground">{user.username}</h2>
                <p className="text-sm text-muted-foreground">{user.email || "—"}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {user.roles.map((r) => (
                    <span key={r} className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[r] ?? "bg-muted text-muted-foreground"}`}>
                      {ROLE_LABELS[r] ?? r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Informations du compte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              {[
                { label: "Identifiant (Keycloak)",  value: user.sub },
                { label: "Nom d'utilisateur",       value: user.username },
                { label: "Adresse email",           value: user.email || "—" },
                { label: "Rôle principal",          value: ROLE_LABELS[role ?? ""] ?? role ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-xs font-medium text-foreground font-mono">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "Accès admin plateforme",    ok: user.roles.includes("admin") },
                { label: "Gestion des tenants",       ok: user.roles.some((r) => ["admin", "tenant_admin"].includes(r)) },
                { label: "Rapports de conformité",    ok: user.roles.some((r) => ["admin", "tenant_admin", "compliance"].includes(r)) },
                { label: "Scoring temps réel",        ok: true },
                { label: "Entraînement des modèles",  ok: user.roles.includes("admin") },
                { label: "Suppression des données",   ok: user.roles.includes("admin") },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-xs text-foreground">{label}</span>
                  {ok
                    ? <Badge variant="success"><Check className="w-3 h-3" />Autorisé</Badge>
                    : <Badge variant="secondary">Non disponible</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Préférences d&apos;affichage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Theme */}
            <div>
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-2">
                <Sun className="w-3.5 h-3.5" /> Thème
              </p>
              <div className="flex gap-2">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                      theme === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    {t === "light" ? "Clair" : t === "dark" ? "Sombre" : "Système"}
                  </button>
                ))}
              </div>
            </div>

            {/* Locale */}
            <div>
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" /> Langue
              </p>
              <div className="flex gap-2">
                {(["fr", "en"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLocale(l)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                      locale === l
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    {l === "fr" ? "Français" : "English"}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} className="w-full" variant={saved ? "outline" : "default"}>
              {saved ? <><Check className="w-4 h-4" /> Préférences sauvegardées</> : "Enregistrer les préférences"}
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle>Sécurité</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Mot de passe</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Géré via Keycloak — modifiable depuis la console d&apos;administration.
                </p>
              </div>
              <Badge variant="secondary">Keycloak</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Authentification</p>
                <p className="text-xs text-muted-foreground mt-0.5">RS256 JWT · Expiration 1h</p>
              </div>
              <Badge variant="success"><Check className="w-3 h-3" /> Actif</Badge>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
