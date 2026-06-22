"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/stores/app.store";
import { formatCurrency } from "@/lib/utils";
import { AlertDrawer, type AlertDetail } from "@/components/alerts/alert-drawer";
import {
  ArrowLeftRight, ShieldX, Percent, Cpu, TrendingUp, TrendingDown,
  Minus, ChevronRight, AlertTriangle, Activity,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell, PieChart, Pie, Legend,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Analytics {
  period_days: number;
  current:  { total: number; fraud: number; fraud_rate: number; avg_score: number };
  previous: { total: number; fraud: number; fraud_rate: number; avg_score: number };
  by_day:       { date: string; total: number; fraud: number }[];
  by_channel:   { channel: string; total: number; fraud: number }[];
  by_risk:      { critical: number; high: number; medium: number; low: number };
  by_country:   { country: string; total: number; fraud: number }[];
  score_distribution: { bucket: string; count: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function delta(current: number, previous: number) {
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(pct).toFixed(1), positive: pct >= 0 };
}

function fmt(n: number) { return n.toLocaleString("fr-FR"); }
function fmtPct(r: number) { return (r * 100).toFixed(2) + "%"; }

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiProps {
  label: string;
  value: string;
  current: number;
  previous: number;
  higherIsBad?: boolean;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
}

function KpiCard({ label, value, current, previous, higherIsBad, icon: Icon, iconBg, iconColor, loading }: KpiProps) {
  const d = delta(current, previous);
  const isGood = d ? (higherIsBad ? !d.positive : d.positive) : null;
  return (
    <Card className="card-hover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
        </div>
        {loading ? (
          <div className="h-8 w-24 rounded bg-muted/50 animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        )}
        {d && !loading && (
          <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${isGood ? "text-success" : "text-danger"}`}>
            {isGood ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {d.positive ? "+" : "−"}{d.pct}% vs période préc.
          </div>
        )}
        {!d && !loading && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <Minus className="w-3 h-3" />
            Pas de données préc.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Period selector ───────────────────────────────────────────────────────────
const PERIODS = [
  { label: "7 j",  days: 7  },
  { label: "30 j", days: 30 },
  { label: "90 j", days: 90 },
];

// ── Risk colors ───────────────────────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#22c55e",
};
const RISK_LABELS: Record<string, string> = {
  critical: "Critique", high: "Élevé", medium: "Moyen", low: "Faible",
};

const STATUS_BADGE: Record<string, string> = {
  open:         "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  validated:    "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  rejected:     "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Ouvert", under_review: "En cours", validated: "Confirmé", rejected: "Faux positif",
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { activeTenantId } = useAppStore();
  const [days, setDays] = useState(30);
  const [selectedAlert, setSelectedAlert] = useState<AlertDetail | null>(null);

  const { data: analytics, isLoading } = useQuery<Analytics>({
    queryKey: ["analytics", activeTenantId, days],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/tenants/${activeTenantId}/analytics?days=${days}`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: alerts = [] } = useQuery<AlertDetail[]>({
    queryKey: ["alerts-dash", activeTenantId],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/tenants/${activeTenantId}/alerts?limit=8&status=open`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const cur  = analytics?.current  ?? { total: 0, fraud: 0, fraud_rate: 0, avg_score: 0 };
  const prev = analytics?.previous ?? { total: 0, fraud: 0, fraud_rate: 0, avg_score: 0 };

  const pieData = analytics
    ? Object.entries(analytics.by_risk)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: RISK_LABELS[k] ?? k, value: v, color: RISK_COLORS[k] }))
    : [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="Tableau de bord"
        subtitle={`Tenant ${activeTenantId} · ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Sélecteur période ── */}
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

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Transactions" value={fmt(cur.total)}
            current={cur.total} previous={prev.total}
            icon={ArrowLeftRight} iconBg="bg-blue-50 dark:bg-blue-900/20" iconColor="text-blue-600 dark:text-blue-400"
            loading={isLoading} />
          <KpiCard label="Fraudes détectées" value={fmt(cur.fraud)}
            current={cur.fraud} previous={prev.fraud} higherIsBad
            icon={ShieldX} iconBg="bg-red-50 dark:bg-red-900/20" iconColor="text-red-600 dark:text-red-400"
            loading={isLoading} />
          <KpiCard label="Taux de fraude" value={fmtPct(cur.fraud_rate)}
            current={cur.fraud_rate} previous={prev.fraud_rate} higherIsBad
            icon={Percent} iconBg="bg-amber-50 dark:bg-amber-900/20" iconColor="text-amber-600 dark:text-amber-400"
            loading={isLoading} />
          <KpiCard label="Score moyen" value={(cur.avg_score * 100).toFixed(1) + "%"}
            current={cur.avg_score} previous={prev.avg_score} higherIsBad
            icon={Activity} iconBg="bg-purple-50 dark:bg-purple-900/20" iconColor="text-purple-600 dark:text-purple-400"
            loading={isLoading} />
        </div>

        {/* ── Activity Chart ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle>Activité des transactions</CardTitle>
            <Badge variant="secondary">{days} derniers jours</Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-52 rounded bg-muted/30 animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={analytics?.by_day ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradLegit"  x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradFraude" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => v.slice(5)} // MM-DD
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                    isAnimationActive={false}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Area type="monotone" dataKey="total"  name="Total"   stroke="#22c55e" strokeWidth={2} fill="url(#gradLegit)"  isAnimationActive={false} />
                  <Area type="monotone" dataKey="fraud"  name="Fraudes" stroke="#ef4444" strokeWidth={2} fill="url(#gradFraude)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── Row : Alertes + Répartition risque + Canal ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Alertes ouvertes */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Alertes ouvertes
                </CardTitle>
                {(alerts as AlertDetail[]).length > 0 && (
                  <span className="text-xs bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">
                    {(alerts as AlertDetail[]).length} en attente
                  </span>
                )}
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {(alerts as AlertDetail[]).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                      <Cpu className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-sm font-medium">Aucune alerte ouverte</p>
                    <p className="text-xs">Toutes les alertes ont été traitées</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Score", "Transaction", "Montant", "Canal", "Statut", ""].map((h, i) => (
                          <th key={i} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(alerts as AlertDetail[]).slice(0, 6).map((a) => (
                        <tr key={a.id} onClick={() => setSelectedAlert(a)}
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className={`h-full rounded-full ${a.score >= 0.8 ? "bg-red-500" : a.score >= 0.5 ? "bg-orange-400" : "bg-yellow-400"}`}
                                  style={{ width: `${a.score * 100}%` }} />
                              </div>
                              <span className={`text-xs font-mono font-bold ${a.score >= 0.8 ? "text-red-600" : a.score >= 0.5 ? "text-orange-500" : "text-yellow-600"}`}>
                                {(a.score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-foreground truncate max-w-[140px]">{a.transaction_id}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-foreground whitespace-nowrap">{formatCurrency(a.amount, a.currency)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{a.channel}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[a.status] ?? ""}`}>
                              {STATUS_LABEL[a.status] ?? a.status}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Répartition par risque */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Répartition par risque</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-44 rounded bg-muted/30 animate-pulse" />
              ) : pieData.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-xs text-muted-foreground">Pas de données</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={68}
                        dataKey="value" isAnimationActive={false} paddingAngle={2}>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        isAnimationActive={false}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-1">
                    {pieData.map(({ name, value, color }) => (
                      <div key={name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                          <span className="text-muted-foreground">{name}</span>
                        </div>
                        <span className="font-semibold text-foreground tabular-nums">{fmt(value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Row : Canal + Pays + Distribution scores ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Par canal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Fraudes par canal</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-40 rounded bg-muted/30 animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={(analytics?.by_channel ?? []).slice(0, 6).map(c => ({
                      name: c.channel.charAt(0).toUpperCase() + c.channel.slice(1),
                      fraudes: c.fraud,
                      légitimes: c.total - c.fraud,
                    }))}
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                    layout="vertical"
                  >
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      isAnimationActive={false}
                    />
                    <Bar dataKey="légitimes" stackId="a" fill="#22c55e" isAnimationActive={false} />
                    <Bar dataKey="fraudes"   stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top pays */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Top pays (fraudes)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-5 rounded bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : (analytics?.by_country ?? []).slice(0, 6).map((c, i) => {
                const maxFraud = analytics?.by_country?.[0]?.fraud ?? 1;
                const pct = c.fraud / maxFraud * 100;
                return (
                  <div key={c.country} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                    <span className="text-xs font-semibold text-foreground w-8">{c.country}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums w-8 text-right">{c.fraud}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Distribution des scores */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Distribution des scores</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-40 rounded bg-muted/30 animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={analytics?.score_distribution ?? []}
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  >
                    <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      isAnimationActive={false}
                    />
                    <Bar dataKey="count" name="Transactions" isAnimationActive={false} radius={[4, 4, 0, 0]}>
                      {(analytics?.score_distribution ?? []).map((entry, i) => (
                        <Cell key={i} fill={
                          entry.bucket.startsWith("80") ? "#ef4444" :
                          entry.bucket.startsWith("60") ? "#f97316" :
                          entry.bucket.startsWith("40") ? "#eab308" :
                          entry.bucket.startsWith("20") ? "#84cc16" : "#22c55e"
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      <AlertDrawer
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onStatusChange={(updated) => setSelectedAlert(updated)}
      />
    </div>
  );
}
