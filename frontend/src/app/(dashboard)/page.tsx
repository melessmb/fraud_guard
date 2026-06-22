"use client";

import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, ShieldX, Percent, Cpu, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useAppStore } from "@/lib/stores/app.store";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend
} from "recharts";
import { useMemo } from "react";

// ── Mock data for sparklines (seed-based) ──
function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function useActivityData(days = 14) {
  return useMemo(() => {
    const rng = seededRandom(42);
    const now = new Date();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (days - 1 - i));
      return {
        date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        legit:  Math.round(150 + rng() * 250),
        fraude: Math.round(1 + rng() * 12),
      };
    });
  }, [days]);
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label:    string;
  value:    string;
  delta?:   string;
  positive?: boolean;
  icon:     React.ElementType;
  iconBg:   string;
  iconColor:string;
}

function KpiCard({ label, value, delta, positive, icon: Icon, iconBg, iconColor }: KpiCardProps) {
  return (
    <Card className="card-hover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        {delta && (
          <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${positive ? "text-success" : "text-danger"}`}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {delta}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Alert row ─────────────────────────────────────────────────────────────────
function AlertBadge({ score }: { score: number }) {
  if (score >= 0.7) return <Badge variant="danger">Fraude</Badge>;
  if (score >= 0.5) return <Badge variant="warning">Révision</Badge>;
  return <Badge variant="success">Légitime</Badge>;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { activeTenantId } = useAppStore();
  const activityData = useActivityData(14);

  const { data: metrics } = useQuery({
    queryKey: ["metrics", activeTenantId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/tenants/${activeTenantId}/metrics`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: alerts } = useQuery({
    queryKey: ["alerts", activeTenantId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/tenants/${activeTenantId}/alerts?limit=5`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const txnCount   = metrics?.transaction_count ?? 0;
  const fraudCount = metrics?.fraud_count ?? 0;
  const fraudRate  = metrics?.detection_rate ?? 0;
  const modelVer   = metrics?.model_version ?? "—";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Dashboard" subtitle={`Tenant ID ${activeTenantId} · ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Total transactions"
            value={txnCount.toLocaleString("fr-FR")}
            delta="+12% vs mois dernier"
            positive
            icon={ArrowLeftRight}
            iconBg="bg-blue-50 dark:bg-blue-900/20"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <KpiCard
            label="Fraudes détectées"
            value={fraudCount.toLocaleString("fr-FR")}
            delta="+4% vs mois dernier"
            positive={false}
            icon={ShieldX}
            iconBg="bg-red-50 dark:bg-red-900/20"
            iconColor="text-red-600 dark:text-red-400"
          />
          <KpiCard
            label="Taux de fraude"
            value={formatPercent(fraudRate)}
            delta="−0.4% vs mois dernier"
            positive
            icon={Percent}
            iconBg="bg-amber-50 dark:bg-amber-900/20"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <KpiCard
            label="Modèle actif"
            value={modelVer}
            delta="Seuil : 0.70"
            icon={Cpu}
            iconBg="bg-green-50 dark:bg-green-900/20"
            iconColor="text-green-600 dark:text-green-400"
          />
        </div>

        {/* ── Activity Chart ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle>Activité des transactions</CardTitle>
            <Badge variant="secondary">14 derniers jours</Badge>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={activityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradLegit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradFraude" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  isAnimationActive={false}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Area type="monotone" dataKey="legit" name="Légitimes" stroke="#22c55e" strokeWidth={2} fill="url(#gradLegit)" isAnimationActive={false} />
                <Area type="monotone" dataKey="fraude" name="Fraudes"  stroke="#ef4444" strokeWidth={2} fill="url(#gradFraude)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ── Bottom Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Recent Alerts */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Alertes récentes</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {!alerts || alerts.length === 0 ? (
                  <p className="px-5 pb-5 text-sm text-muted-foreground">Aucune alerte disponible.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Date", "Transaction", "Canal", "Montant", "Statut"].map((h) => (
                          <th key={h} className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(alerts as any[]).slice(0, 5).map((alert: any) => (
                        <tr key={alert.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(alert.timestamp).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-5 py-3 font-medium text-foreground text-xs">{alert.transaction_id}</td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">{alert.channel}</td>
                          <td className="px-5 py-3 text-xs font-medium text-foreground whitespace-nowrap">{formatCurrency(alert.amount, alert.currency)}</td>
                          <td className="px-5 py-3"><AlertBadge score={alert.score} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* By Channel */}
          <Card>
            <CardHeader>
              <CardTitle>Par canal</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={[
                    { name: "Mobile", fraudes: 50 },
                    { name: "Web",    fraudes: 25 },
                    { name: "POS",    fraudes: 15 },
                    { name: "ATM",    fraudes: 10 },
                  ]}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    isAnimationActive={false}
                  />
                  <Bar dataKey="fraudes" fill="#22c55e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
