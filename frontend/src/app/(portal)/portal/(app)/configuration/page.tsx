"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api/portal-fetch";
import { usePortalAuthStore } from "@/lib/stores/portal-auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { PortalPageHeader } from "@/components/portal/page-header";
import { Save, Loader2 } from "lucide-react";

interface Policy {
  high_risk_threshold: number;
  medium_risk_threshold: number;
  auto_block_threshold: number;
  webhook_url: string;
}

export default function PortalConfigurationPage() {
  const { user } = usePortalAuthStore();
  const { activeTenantId } = useAppStore();
  const [form, setForm] = useState<Policy>({ high_risk_threshold: 0.8, medium_risk_threshold: 0.5, auto_block_threshold: 0.95, webhook_url: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const tenantId = activeTenantId;
    if (!tenantId) return;
    portalFetch(`/api/v1/tenants/${tenantId}/policies`)
      .then(r => r.json())
      .then(data => setForm(f => ({ ...f, ...data })))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tenantId = activeTenantId;
    if (!tenantId) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await portalFetch(`/api/v1/tenants/${tenantId}/policies`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
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
      <PortalPageHeader title="Configuration" subtitle="Ajustez les seuils de détection et les notifications de votre compte." />

      {loading ? (
        <div className="mt-6 h-48 bg-card border border-border rounded-xl animate-pulse" />
      ) : (
        <form onSubmit={handleSave} className="mt-6 max-w-lg bg-card border border-border rounded-xl p-6 space-y-6">
          {field("Seuil de risque élevé", "high_risk_threshold", "Les transactions au-dessus de ce score sont marquées comme risque élevé.")}
          {field("Seuil de risque moyen", "medium_risk_threshold", "Les transactions entre ce seuil et le seuil élevé sont en zone de surveillance.")}
          {field("Seuil de blocage automatique", "auto_block_threshold", "Les transactions au-dessus de ce score sont bloquées automatiquement.")}
          {field("URL de webhook (notifications)", "webhook_url", "Recevez les alertes en temps réel sur votre serveur.")}

          {error && <p className="text-sm text-red-500">{error}</p>}
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
  );
}
