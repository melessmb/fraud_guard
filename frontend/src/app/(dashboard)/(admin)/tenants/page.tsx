"use client";

import { apiFetch } from "@/lib/api/fetch";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Plus, Building2, Pencil, Trash2, X, Check } from "lucide-react";
import type { TenantResponse } from "@/types/api";

const COUNTRIES = ["CI", "SN", "GH", "BJ", "ML", "BF", "TG", "NG", "CM", "GA"];
const ENVS = ["production", "sandbox"];

function TenantModal({ tenant, onClose, onSaved }: {
  tenant?: TenantResponse;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name:        tenant?.name ?? "",
    country:     tenant?.country ?? "CI",
    environment: tenant?.environment ?? "sandbox",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const url     = tenant ? `/api/v1/tenants/${tenant.id}` : "/api/v1/tenants";
      const method  = tenant ? "PUT" : "POST";
      const res     = await apiFetch(url, {
        method,
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Erreur");
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-foreground">
            {tenant ? "Modifier le tenant" : "Nouveau tenant"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Nom de l&apos;organisation</label>
            <input value={form.name} onChange={(e) => update("name", e.target.value)} required
              placeholder="ex: Orange Money CI"
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Pays</label>
              <select value={form.country} onChange={(e) => update("country", e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Environnement</label>
              <select value={form.environment} onChange={(e) => update("environment", e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {ENVS.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="flex-1" loading={loading}>
              {tenant ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TenantsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<"create" | TenantResponse | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);

  const { data: tenants = [], isLoading } = useQuery<TenantResponse[]>({
    queryKey: ["tenants"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/tenants", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/api/v1/tenants/${id}`, { method: "DELETE" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenants"] }); setToDelete(null); },
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Gestion des tenants" subtitle="Institutions financières clientes" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{tenants.length} tenant{tenants.length > 1 ? "s" : ""}</span>
          </div>
          <Button onClick={() => setModal("create")} size="sm">
            <Plus className="w-4 h-4" />
            Nouveau tenant
          </Button>
        </div>

        <Card>
          <CardContent className="px-0 pb-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Chargement…</div>
            ) : tenants.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                <Building2 className="w-8 h-8 opacity-20" />
                <p className="text-sm">Aucun tenant. Créez-en un.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["ID", "Nom", "Pays", "Environnement", "Keycloak ID", "Créé le", "Actions"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono text-muted-foreground">#{t.id}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-foreground">{t.name}</td>
                      <td className="px-5 py-3">
                        <Badge variant="secondary">{t.country}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={t.environment === "production" ? "default" : "secondary"}>
                          {t.environment}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-muted-foreground truncate max-w-32">
                        {t.keycloak_id ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setModal(t)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {toDelete === t.id ? (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                onClick={() => deleteMutation.mutate(t.id)} loading={deleteMutation.isPending}>
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setToDelete(null)}>
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setToDelete(t.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {modal && (
        <TenantModal
          tenant={modal === "create" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["tenants"] })}
        />
      )}
    </div>
  );
}
