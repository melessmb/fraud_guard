"use client";

import { apiFetch } from "@/lib/api/fetch";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/stores/app.store";
import { Zap, ShieldCheck, ShieldX, Trash2, BarChart2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const CHANNELS = ["mobile_money", "web", "pos", "atm"];
const COUNTRIES = ["CI", "SN", "GH", "BJ", "ML", "BF", "TG", "NG"];
const CURRENCIES = ["XOF", "GHS", "NGN", "USD"];

interface ScoreResult {
  transaction_id: string;
  score: number;
  is_fraud: boolean;
  model_version: string;
  explanations?: {
    shap_values?: Record<string, number>;
    base_value?: number;
    model_auc?: number;
    [key: string]: unknown;
  } | null;
  timestamp: string;
}

function RiskGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? "#ef4444" : score >= 0.5 ? "#f59e0b" : "#22c55e";
  const label = score >= 0.7 ? "Élevé" : score >= 0.5 ? "Moyen" : "Faible";

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div
        className="relative w-32 h-32 rounded-full flex items-center justify-center"
        style={{ background: `conic-gradient(${color} ${pct}%, hsl(var(--muted)) ${pct}%)` }}
      >
        <div className="w-24 h-24 rounded-full bg-card flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{pct}%</span>
          <span className="text-[10px] text-muted-foreground">score</span>
        </div>
      </div>
      <div>
        <Badge variant={score >= 0.7 ? "danger" : score >= 0.5 ? "warning" : "success"}>
          Risque {label}
        </Badge>
      </div>
    </div>
  );
}

export default function ScoringPage() {
  const { activeTenantId } = useAppStore();
  const [history, setHistory] = useState<ScoreResult[]>([]);

  const [form, setForm] = useState({
    transaction_id: `TXN-${Date.now()}`,
    amount: "50000",
    currency: "XOF",
    channel: "mobile_money",
    country: "CI",
    device_fingerprint: "fp_demo_001",
    ip_address: "197.234.1.1",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/v1/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          tenant_id: activeTenantId,
          amount: parseFloat(form.amount),
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Erreur scoring");
      return res.json();
    },
    onSuccess: (data) => {
      setHistory((prev) => [
        { ...data, timestamp: new Date().toISOString() },
        ...prev.slice(0, 9),
      ]);
      setForm((f) => ({ ...f, transaction_id: `TXN-${Date.now()}` }));
    },
  });

  const latest = history[0];
  const shapData = latest?.explanations?.shap_values
    ? Object.entries(latest.explanations.shap_values)
        .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
        .slice(0, 8)
        .map(([k, v]) => ({ name: k, value: parseFloat((v as number).toFixed(4)) }))
    : [];

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Scoring temps réel" subtitle="Analyse de transaction par le modèle ML" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Form ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Analyser une transaction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Transaction ID</label>
                  <input value={form.transaction_id} onChange={(e) => update("transaction_id", e.target.value)}
                    className="w-full h-9 px-3 text-xs font-mono rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Montant</label>
                  <input type="number" value={form.amount} onChange={(e) => update("amount", e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Devise</label>
                  <select value={form.currency} onChange={(e) => update("currency", e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Canal</label>
                  <select value={form.channel} onChange={(e) => update("channel", e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    {CHANNELS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Pays</label>
                  <select value={form.country} onChange={(e) => update("country", e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">IP Address</label>
                  <input value={form.ip_address} onChange={(e) => update("ip_address", e.target.value)}
                    className="w-full h-9 px-3 text-sm font-mono rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => mutation.mutate()}
                loading={mutation.isPending}
              >
                <Zap className="w-4 h-4" />
                {mutation.isPending ? "Analyse en cours…" : "Analyser la transaction"}
              </Button>

              {mutation.isError && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  Erreur : vérifiez que l&apos;API est accessible.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Result ── */}
          <div className="space-y-5">
            {latest ? (
              <>
                <Card className={latest.is_fraud ? "border-red-200 dark:border-red-900/40" : "border-green-200 dark:border-green-900/40"}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      {latest.is_fraud
                        ? <ShieldX className="w-5 h-5 text-red-500" />
                        : <ShieldCheck className="w-5 h-5 text-green-500" />}
                      <div>
                        <p className={`text-sm font-semibold ${latest.is_fraud ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                          {latest.is_fraud ? "Fraude détectée — transaction bloquée" : "Transaction légitime — approuvée"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Modèle {latest.model_version} · {latest.transaction_id}
                        </p>
                      </div>
                    </div>
                    <RiskGauge score={latest.score} />
                  </CardContent>
                </Card>

                {shapData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4" />
                        Facteurs déterminants (SHAP)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={shapData} layout="vertical" margin={{ left: 20, right: 20 }}>
                          <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                            isAnimationActive={false}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                            {shapData.map((entry, i) => (
                              <Cell key={i} fill={entry.value > 0 ? "#ef4444" : "#22c55e"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="h-full min-h-48">
                <CardContent className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-16">
                  <Zap className="w-10 h-10 opacity-20" />
                  <p className="text-sm">Soumettez une transaction pour voir le résultat.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ── History ── */}
        {history.length > 0 && (
          <Card className="mt-5">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Historique de session</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setHistory([])} className="text-muted-foreground">
                <Trash2 className="w-3.5 h-3.5" />
                Effacer
              </Button>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Transaction", "Montant", "Canal", "Score", "Résultat", "Modèle"].map((h) => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.transaction_id + r.timestamp} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-5 py-2.5 font-mono text-xs text-foreground">{r.transaction_id}</td>
                      <td className="px-5 py-2.5 text-xs text-muted-foreground">—</td>
                      <td className="px-5 py-2.5 text-xs text-muted-foreground">—</td>
                      <td className="px-5 py-2.5 text-xs font-mono">{(r.score * 100).toFixed(1)}%</td>
                      <td className="px-5 py-2.5">
                        {r.is_fraud
                          ? <Badge variant="danger">Fraude</Badge>
                          : <Badge variant="success">Légitime</Badge>}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-muted-foreground">{r.model_version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
