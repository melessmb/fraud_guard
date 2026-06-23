"use client";

import { apiFetch } from "@/lib/api/fetch";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/stores/app.store";
import { formatPercent } from "@/lib/utils";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend, PieChart, Pie, Cell,
} from "recharts";

const PERIODS = ["7j", "14j", "30j", "90j"];

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function useAnalyticsData(days: number) {
  return useMemo(() => {
    const rng = seeded(99);
    const now = new Date();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (days - 1 - i));
      const legit  = Math.round(180 + rng() * 220);
      const fraude = Math.round(2 + rng() * 15);
      return {
        date:     d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        legit,
        fraude,
        total:    legit + fraude,
        rate:     parseFloat(((fraude / (legit + fraude)) * 100).toFixed(2)),
        amount:   Math.round(2_000_000 + rng() * 8_000_000),
      };
    });
  }, [days]);
}

const CHANNEL_DATA = [
  { name: "Mobile Money", value: 52, fraudes: 45 },
  { name: "Web",          value: 23, fraudes: 25 },
  { name: "POS",          value: 15, fraudes: 18 },
  { name: "ATM",          value: 10, fraudes: 12 },
];

const COUNTRY_DATA = [
  { pays: "CI",  transactions: 1240, fraudes: 87 },
  { pays: "SN",  transactions: 890,  fraudes: 54 },
  { pays: "GH",  transactions: 670,  fraudes: 31 },
  { pays: "BJ",  transactions: 430,  fraudes: 22 },
  { pays: "ML",  transactions: 310,  fraudes: 19 },
  { pays: "BF",  transactions: 180,  fraudes: 11 },
];

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

export default function AnalytiquePage() {
  const { activeTenantId } = useAppStore();
  const [period, setPeriod] = useState("14j");
  const days = period === "7j" ? 7 : period === "30j" ? 30 : period === "90j" ? 90 : 14;
  const data = useAnalyticsData(days);

  const { data: metrics } = useQuery({
    queryKey: ["metrics", activeTenantId],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/tenants/${activeTenantId}/metrics`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const totalTx    = data.reduce((s, d) => s + d.total, 0);
  const totalFraud = data.reduce((s, d) => s + d.fraude, 0);
  const avgRate    = totalTx ? totalFraud / totalTx : 0;

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Analytique" subtitle="Tendances et statistiques de détection" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Period selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Période :</span>
          <div className="flex items-center gap-1 border border-border rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground">{totalTx.toLocaleString("fr-FR")}</span> transactions</span>
            <span><span className="font-semibold text-red-500">{totalFraud}</span> fraudes</span>
            <span>Taux moyen : <span className="font-semibold text-foreground">{formatPercent(avgRate)}</span></span>
          </div>
        </div>

        {/* Volume Chart */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle>Volume de transactions</CardTitle>
            <Badge variant="secondary">{period}</Badge>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gLegit"  x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gFraude" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={Math.floor(days / 7)} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} isAnimationActive={false} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Area type="monotone" dataKey="legit"  name="Légitimes" stroke="#22c55e" strokeWidth={2} fill="url(#gLegit)"  isAnimationActive={false} />
                <Area type="monotone" dataKey="fraude" name="Fraudes"   stroke="#ef4444" strokeWidth={2} fill="url(#gFraude)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fraud rate + Country */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Fraud rate trend */}
          <Card>
            <CardHeader>
              <CardTitle>Évolution du taux de fraude (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={Math.floor(days / 5)} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} isAnimationActive={false} formatter={(v: number) => [`${v}%`, "Taux"]} />
                  <Line type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* By country */}
          <Card>
            <CardHeader>
              <CardTitle>Fraudes par pays</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={COUNTRY_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="pays" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} isAnimationActive={false} />
                  <Bar dataKey="transactions" name="Transactions" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="fraudes"      name="Fraudes"      fill="#ef4444" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Channel distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Distribution par canal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={CHANNEL_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                      dataKey="value" isAnimationActive={false} strokeWidth={0}>
                      {CHANNEL_DATA.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`]} isAnimationActive={false} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {CHANNEL_DATA.map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                        <span className="text-xs text-foreground">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-muted rounded-full">
                          <div className="h-full rounded-full" style={{ width: `${c.value}%`, background: COLORS[i] }} />
                        </div>
                        <span className="text-xs font-semibold text-foreground w-8 text-right">{c.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model performance */}
          <Card>
            <CardHeader>
              <CardTitle>Performance du modèle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "AUC-ROC",           value: 0.94, color: "bg-green-500" },
                { label: "Précision",          value: 0.89, color: "bg-blue-500" },
                { label: "Rappel",             value: 0.82, color: "bg-purple-500" },
                { label: "F1-Score",           value: 0.85, color: "bg-amber-500" },
                { label: "Faux positifs",      value: 0.06, color: "bg-red-400" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-foreground">{(value * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-1">
                Modèle : {metrics?.model_version ?? "LightGBM v1.0.0"} · Seuil : 0.70
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
