"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api/portal-fetch";
import { usePortalAuthStore } from "@/lib/stores/portal-auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import {
  Save, Loader2, Key, RefreshCw, Trash2, Copy, Check,
  CheckCircle2, XCircle,
} from "lucide-react";

interface Policy {
  high_risk_threshold: number;
  medium_risk_threshold: number;
  auto_block_threshold: number;
  webhook_url: string;
}

export default function PortalConfigurationPage() {
  const { primaryRole } = usePortalAuthStore();
  const { activeTenantId } = useAppStore();
  const role = primaryRole();
  const isTenantAdmin = role === "tenant_admin";

  const [form, setForm] = useState<Policy>({
    high_risk_threshold: 0.8,
    medium_risk_threshold: 0.5,
    auto_block_threshold: 0.95,
    webhook_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [policyError, setPolicyError] = useState("");

  // API Key state
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [keyLoading, setKeyLoading] = useState(true);
  const [keyGenerating, setKeyGenerating] = useState(false);
  const [keyRevoking, setKeyRevoking] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyError, setKeyError] = useState("");

  const tenantId = activeTenantId;

  useEffect(() => {
    if (!tenantId) return;

    // Charger les policies
    portalFetch(`/api/v1/tenants/${tenantId}/policies`)
      .then(r => r.json())
      .then(data => setForm(f => ({ ...f, ...data })))
      .catch(console.error)
      .finally(() => setLoading(false));

    // Charger le statut de l'API key
    portalFetch(`/api/v1/tenants/${tenantId}/api-key/status`)
      .then(r => r.json())
      .then(data => setHasKey(data.has_key ?? false))
      .catch(() => setHasKey(false))
      .finally(() => setKeyLoading(false));
  }, [tenantId]);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true); setPolicyError(""); setSaved(false);
    try {
      const res = await portalFetch(`/api/v1/tenants/${tenantId}/policies`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setPolicyError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!tenantId) return;
    setKeyGenerating(true); setKeyError(""); setNewKey(null);
    try {
      const res = await portalFetch(`/api/v1/tenants/${tenantId}/api-key`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Erreur ${res.status}`);
      setNewKey(data.api_key);
      setHasKey(true);
    } catch (err: unknown) {
      setKeyError(err instanceof Error ? err.message : "Erreur lors de la génération");
    } finally {
      setKeyGenerating(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!tenantId) return;
    const confirmed = confirm("Révoquer l'API key ? Toutes les intégrations utilisant cette clé cesseront de fonctionner.");
    if (!confirmed) return;
    setKeyRevoking(true);
    setKeyError("");
    setNewKey(null);
    try {
      const res = await portalFetch(`/api/v1/tenants/${tenantId}/api-key`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`Erreur ${res.status}`);
      setHasKey(false);
    } catch (err: unknown) {
      setKeyError(err instanceof Error ? err.message : "Erreur lors de la révocation");
    } finally {
      setKeyRevoking(false);
    }
  };

  const handleCopy = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const field = (label: string, key: keyof Policy, desc: string) => (
    <div key={key}>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      <p className="text-xs text-muted-foreground mb-1.5">{desc}</p>
      {key === "webhook_url" ? (
        <input
          type="url"
          value={form[key] as string}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder="https://votre-serveur.com/webhook"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <div className="flex items-center gap-3">
          <input
            type="range" min="0" max="1" step="0.01"
            value={form[key] as number}
            onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) }))}
            className="flex-1"
          />
          <span className="text-sm font-semibold text-foreground w-12 text-right">
            {((form[key] as number) * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">

      <div className="mt-6 space-y-6 max-w-lg">

        {/* ── Section API Key ───────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-foreground">Clé API</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Utilisée pour authentifier vos appels à l'API FraudGuard depuis vos systèmes.
          </p>

          {keyLoading ? (
            <div className="h-10 bg-muted/40 rounded-lg animate-pulse" />
          ) : (
            <>
              {/* Statut */}
              <div className="flex items-center gap-2">
                {hasKey ? (
                  <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-sm text-green-600 dark:text-green-400 font-medium">Clé active</span></>
                ) : (
                  <><XCircle className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Aucune clé configurée</span></>
                )}
              </div>

              {/* Nouvelle clé affichée une seule fois */}
              {newKey && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-2">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Copiez cette clé maintenant — elle ne sera plus affichée.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-background rounded px-2 py-1.5 border border-border text-foreground truncate">
                      {newKey}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="p-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
                      title="Copier"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                  </div>
                </div>
              )}

              {keyError && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  {keyError}
                </p>
              )}

              {/* Actions — uniquement pour tenant_admin */}
              {isTenantAdmin && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleGenerateKey}
                    disabled={keyGenerating || keyRevoking}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                  >
                    {keyGenerating
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <RefreshCw className="w-3.5 h-3.5" />
                    }
                    {hasKey ? "Regénérer" : "Générer une clé"}
                  </button>

                  {hasKey && (
                    <button
                      onClick={handleRevokeKey}
                      disabled={keyGenerating || keyRevoking}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50 text-xs font-semibold transition-colors"
                    >
                      {keyRevoking
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                      Révoquer
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Section Politiques de détection ──────────────────────────── */}
        {loading ? (
          <div className="h-64 bg-card border border-border rounded-xl animate-pulse" />
        ) : (
          <form onSubmit={handleSavePolicy} className="bg-card border border-border rounded-xl p-6 space-y-6">
            <h2 className="text-sm font-semibold text-foreground">Politiques de détection</h2>

            {field("Seuil de risque élevé", "high_risk_threshold", "Les transactions au-dessus de ce score sont marquées comme risque élevé.")}
            {field("Seuil de risque moyen", "medium_risk_threshold", "Les transactions entre ce seuil et le seuil élevé sont en zone de surveillance.")}
            {field("Seuil de blocage automatique", "auto_block_threshold", "Les transactions au-dessus de ce score sont bloquées automatiquement.")}
            {field("URL de webhook (notifications)", "webhook_url", "Recevez les alertes en temps réel sur votre serveur.")}

            {policyError && <p className="text-sm text-destructive">{policyError}</p>}
            {saved && <p className="text-sm text-green-600">Paramètres enregistrés avec succès.</p>}

            <button
              type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
