"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, TrendingUp, TrendingDown, Minus,
  ArrowLeftRight, ShieldX, Percent, Globe,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, AreaChart, Area,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TenantStat {
  id: number;
  name: string;
  country: string;
  environment: string;
  transactions: number;
  fraud: number;
  fraud_rate: number;
  avg_score: number;
  trend_delta: number;
  sparkline: { date: string; fraud: number; total: number }[];
}

interface Overview {
  period_days: number;
  tenant_count: number;
  totals: { transactions: number; fraud: number; fraud_rate: number };
  tenants: TenantStat[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt  = (n: number) => n.toLocaleString("fr-FR");
const fmtP = (r: number) => (r * 100).toFixed(2) + "%";
const PERIODS = [{ label: "7 j", days: 7 }, { label: "30 j", days: 30 }, { label: "90 j", days: 90 }];

function TrendBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.001)
    return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="w-3 h-3" /> stable</span>;
  const up = delta > 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${up ? "text-red-500" : "text-green-600"}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : ""}{(delta * 100).toFixed(2)}pp
    </span>
  );
}

function Sparkline({ data }: { data: TenantStat["sparkline"] }) {
  if (!data.length) return <div className="h-10 flex items-center justify-center text-[10px] text-muted-foreground">—</div>;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="fraud" stroke="#ef4444" strokeWidth={1.5}
          fill="url(#spGrad)" dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ComparatifPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery<Overview>({
    queryKey: ["admin-overview", days],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/admin/overview?days=${days}`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const tenants = data?.tenants ?? [];
  const totals  = data?.totals  ?? { transactions: 0, fraud: 0, fraud_rate: 0 };

  // Chart data — top 10 par volume
  const barData = [...tenants]
    .sort((a, b) => b.transactions - a.transactions)
    .slice(0, 10)
    .map(t => ({
      name:       t.name.length > 12 ? t.name.slice(0, 12) + "…" : t.name,
      légitimes:  t.transactions - t.fraud,
      fraudes:    t.fraud,
      fraud_rate: t.fraud_rate,
    }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Vue comparative"
        subtitle={`${data?.tenant_count ?? 0} tenants · ${days} derniers jours`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Sélecteur période */}
        <div className="flex items-center gap-1.5 border border-border rounded-lg p-1 w-fit">
          {PERIODS.map(({ label, days: d }) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                days === d ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* KPI globaux */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Transactions totales", value: fmt(totals.transactions), icon: ArrowLeftRight, bg: "bg-blue-50 dark:bg-blue-900/20",   ic: "text-blue-600 dark:text-blue-400" },
            { label: "Fraudes détectées",    value: fmt(totals.fraud),         icon: ShieldX,        bg: "bg-red-50 dark:bg-red-900/20",     ic: "text-red-600 dark:text-red-400" },
            { label: "Taux global de fraude",value: fmtP(totals.fraud_rate),   icon: Percent,        bg: "bg-amber-50 dark:bg-amber-900/20", ic: "text-amber-600 dark:text-amber-400" },
          ].map(({ label, value, icon: Icon, bg, ic }) => (
            <Card key={label} className="card-hover">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                  <Icon className={`w-5 h-5 ${ic}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
                  {isLoading
                    ? <div className="h-7 w-20 rounded bg-muted/50 animate-pulse mt-1" />
                    : <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
                  }
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Graphique volumes comparatifs */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle>Volumes par tenant (top 10)</CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" /> Légitimes</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Fraudes</span>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-56 rounded bg-muted/30 animate-pulse" />
            ) : barData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number, name: string) => [fmt(value), name]}
                    isAnimationActive={false}
                  />
                  <Bar dataKey="légitimes" stackId="a" fill="#4ade80" isAnimationActive={false} />
                  <Bar dataKey="fraudes"   stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tableau comparatif */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Classement par taux de fraude
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {isLoading ? (
              <div className="h-40 rounded bg-muted/30 animate-pulse mx-5 mb-5" />
            ) : tenants.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Aucune donnée</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["#", "Tenant", "Pays", "Env.", "Transactions", "Fraudes", "Taux", "Score moy.", "Tendance", "14j"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t, i) => (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-xs font-semibold text-foreground">{t.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">#{t.id}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Globe className="w-3 h-3" />{t.country}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={t.environment === "production" ? "default" : "secondary"} className="text-[10px]">
                            {t.environment}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-foreground tabular-nums">{fmt(t.transactions)}</td>
                        <td className="px-4 py-3 text-xs font-mono text-red-500 tabular-nums font-semibold">{fmt(t.fraud)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${
                                t.fraud_rate >= 0.1 ? "bg-red-500" :
                                t.fraud_rate >= 0.05 ? "bg-orange-400" : "bg-yellow-400"
                              }`} style={{ width: `${Math.min(t.fraud_rate * 500, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-semibold tabular-nums ${
                              t.fraud_rate >= 0.1 ? "text-red-500" :
                              t.fraud_rate >= 0.05 ? "text-orange-500" : "text-foreground"
                            }`}>{fmtP(t.fraud_rate)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground tabular-nums">
                          {(t.avg_score * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3"><TrendBadge delta={t.trend_delta} /></td>
                        <td className="px-4 py-3 w-24"><Sparkline data={t.sparkline} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
