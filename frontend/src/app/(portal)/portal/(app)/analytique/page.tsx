"use client";

import { useEffect, useState, useCallback } from "react";
import { portalFetch } from "@/lib/api/portal-fetch";
import { useAppStore } from "@/lib/stores/app.store";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PeriodSummary { total: number; fraud: number; fraud_rate: number; avg_score: number; }
interface DailyPoint    { date: string; total: number; fraud: number; }
interface ChannelStat   { channel: string; total: number; fraud: number; }
interface CountryStat   { country: string; total: number; fraud: number; }
interface ScoreBucket   { bucket: string; count: number; }

interface Analytics {
  period_days: number;
  current:  PeriodSummary;
  previous: PeriodSummary;
  by_day:   DailyPoint[];
  by_channel: ChannelStat[];
  by_country: CountryStat[];
  score_distribution: ScoreBucket[];
}

// ── Mini composants graphiques ────────────────────────────────────────────────

function SparkLine({ points, color = "#3b82f6", h = 48 }: { points: number[]; color?: string; h?: number }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const w = 200;
  const pts = points.map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / max) * (h - 4)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BarChart({ data, labelKey, valueKey, colorFn }: {
  data: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
  colorFn?: (i: number) => string;
}) {
  const max = Math.max(...data.map(d => d[valueKey] as number), 1);
  const colors = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#14b8a6", "#f97316"];
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const pct = ((d[valueKey] as number) / max) * 100;
        const color = colorFn ? colorFn(i) : colors[i % colors.length];
        return (
          <div key={String(d[labelKey])} className="flex items-center gap-3">
            <span className="w-20 text-xs text-muted-foreground truncate text-right shrink-0">{String(d[labelKey])}</span>
            <div className="flex-1 bg-muted/30 rounded-full h-5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <span className="w-10 text-xs font-semibold text-foreground text-right shrink-0">{d[valueKey] as number}</span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ data }: { data: DailyPoint[] }) {
  if (!data.length) return <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">Aucune donnée</div>;
  const totals = data.map(d => d.total);
  const frauds = data.map(d => d.fraud);
  const maxVal = Math.max(...totals, 1);
  const W = 600; const H = 120; const PAD = 8;
  const x = (i: number) => PAD + (i / (data.length - 1 || 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / maxVal) * (H - PAD * 2);
  const totalPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.total)}`).join(" ");
  const fraudPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.fraud)}`).join(" ");
  const labels = data.length <= 14
    ? data.map((d, i) => ({ i, label: d.date.slice(5) }))
    : data.filter((_, i) => i % Math.ceil(data.length / 7) === 0).map((d, j) => ({
        i: data.indexOf(d), label: d.date.slice(5)
      }));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full min-w-[300px]">
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={PAD} x2={W - PAD} y1={y(maxVal * t)} y2={y(maxVal * t)}
            stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
        ))}
        <path d={totalPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
        <path d={fraudPath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 2" />
        {labels.map(({ i, label }) => (
          <text key={i} x={x(i)} y={H + 14} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.5">{label}</text>
        ))}
      </svg>
      <div className="flex gap-4 mt-1 justify-end">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="inline-block w-4 h-0.5 bg-blue-500" /> Transactions
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="inline-block w-4 h-0.5 bg-red-500 border-dashed" style={{borderTop:"2px dashed #ef4444", background:"none"}} /> Fraudes
        </span>
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, current, previous, fmt }: {
  label: string; current: number; previous: number;
  fmt: (v: number) => string;
}) {
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const up = delta > 0;
  const neutral = Math.abs(delta) < 0.5;
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{fmt(current)}</p>
      <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${neutral ? "text-muted-foreground" : up ? "text-red-500" : "text-green-500"}`}>
        {neutral ? <Minus className="w-3 h-3" /> : up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {neutral ? "Stable" : `${up ? "+" : ""}${delta.toFixed(1)}% vs période préc.`}
      </div>
    </div>
  );
}

// ── Période selector ──────────────────────────────────────────────────────────

const PERIODS = [
  { label: "7 j",  days: 7  },
  { label: "14 j", days: 14 },
  { label: "30 j", days: 30 },
];

// ── Page principale ───────────────────────────────────────────────────────────

export default function PortalAnalytiquePage() {
  const { activeTenantId } = useAppStore();
  const [days, setDays]   = useState(30);
  const [data, setData]   = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true);
    try {
      const res = await portalFetch(`/api/v1/tenants/${activeTenantId}/analytics?days=${days}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, days]);

  useEffect(() => { load(); }, [load]);

  const pct = (v: number) => `${(v * 100).toFixed(2)} %`;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Sélecteur de période */}
      <div className="flex gap-2">
        {PERIODS.map(p => (
          <button key={p.days} onClick={() => setDays(p.days)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              days === p.days
                ? "bg-blue-600 text-white"
                : "bg-card border border-border text-muted-foreground hover:bg-accent"
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Impossible de charger les données.</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Transactions" current={data.current.total} previous={data.previous.total}
              fmt={v => v.toLocaleString()} />
            <KpiCard label="Fraudes détectées" current={data.current.fraud} previous={data.previous.fraud}
              fmt={v => v.toLocaleString()} />
            <KpiCard label="Taux de fraude" current={data.current.fraud_rate} previous={data.previous.fraud_rate}
              fmt={pct} />
            <KpiCard label="Score moyen" current={data.current.avg_score} previous={data.previous.avg_score}
              fmt={v => v.toFixed(3)} />
          </div>

          {/* Courbe temporelle */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Évolution sur {days} jours</h3>
            <LineChart data={data.by_day} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Par canal */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Transactions par canal</h3>
              <BarChart
                data={data.by_channel.map(c => ({ canal: c.channel, total: c.total, fraudes: c.fraud }))}
                labelKey="canal" valueKey="total"
              />
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                {data.by_channel.map(c => (
                  <div key={c.channel} className="flex justify-between text-xs text-muted-foreground">
                    <span>{c.channel}</span>
                    <span className="font-medium text-foreground">
                      {c.total > 0 ? `${((c.fraud / c.total) * 100).toFixed(1)}% fraude` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Par pays */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Transactions par pays</h3>
              <BarChart
                data={data.by_country.map(c => ({ pays: c.country, total: c.total }))}
                labelKey="pays" valueKey="total"
                colorFn={i => ["#3b82f6","#6366f1","#8b5cf6","#ec4899","#f59e0b"][i % 5]}
              />
            </div>
          </div>

          {/* Distribution des scores */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Distribution des scores ML</h3>
            <div className="flex items-end gap-1 h-24">
              {data.score_distribution.map((b, i) => {
                const max = Math.max(...data.score_distribution.map(x => x.count), 1);
                const pctH = (b.count / max) * 100;
                const risk = i < 5 ? "bg-green-500/70" : i < 7 ? "bg-yellow-500/70" : "bg-red-500/70";
                return (
                  <div key={b.bucket} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {b.count}
                    </span>
                    <div className={`w-full rounded-t ${risk} transition-all duration-500`}
                      style={{ height: `${pctH}%` }} title={`${b.bucket}: ${b.count}`} />
                    <span className="text-[9px] text-muted-foreground">{b.bucket.split("-")[0]}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500/70" /> Faible risque</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500/70" /> Moyen</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/70" /> Élevé</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
