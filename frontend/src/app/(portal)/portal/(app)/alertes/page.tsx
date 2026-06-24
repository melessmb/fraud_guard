"use client";

import { useEffect, useState, useCallback } from "react";
import { portalFetch } from "@/lib/api/portal-fetch";
import { usePortalAuthStore } from "@/lib/stores/portal-auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { PortalPageHeader } from "@/components/portal/page-header";
import { AlertDrawer, type AlertDetail } from "@/components/alerts/alert-drawer";
import { CheckCircle, AlertTriangle, ChevronRight } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  open:         "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  validated:    "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  rejected:     "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Ouvert", under_review: "En cours", validated: "Confirmé", rejected: "Faux positif",
};
const RISK_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  low:      "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
};

export default function PortalAlertesPage() {
  const { user } = usePortalAuthStore();
  const { activeTenantId } = useAppStore();
  const [alerts, setAlerts] = useState<AlertDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<AlertDetail | null>(null);

  const load = useCallback(async (sf: string) => {
    const tenantId = activeTenantId;
    if (!tenantId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (sf) params.set("status", sf);
      const res = await portalFetch(`/api/v1/tenants/${tenantId}/alerts?${params}`);
      if (res.ok) setAlerts(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(statusFilter); }, [load, statusFilter]);

  const handleStatusChange = (updated: AlertDetail) => {
    setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));
    setSelected(updated);
  };

  const openCount = alerts.filter(a => a.status === "open").length;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <PortalPageHeader title="Mes alertes fraude" subtitle="Cliquez sur une alerte pour la qualifier ou la rejeter." />
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          <span className="text-xs font-semibold text-red-700 dark:text-red-400">{openCount} ouvertes</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border">
          <span className="text-xs font-semibold text-muted-foreground">{alerts.length} total</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 border border-border rounded-lg p-1 w-fit">
        {[{v:"",l:"Toutes"},{v:"open",l:"Ouvertes"},{v:"under_review",l:"En cours"},{v:"validated",l:"Confirmées"},{v:"rejected",l:"Faux positifs"}].map(({v,l})=>(
          <button key={v} onClick={()=>setStatusFilter(v)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${statusFilter===v?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
            {l}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="mt-6 space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse"/>)}</div>
      ) : alerts.length === 0 ? (
        <div className="mt-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3"/>
          <p className="font-semibold text-foreground">Aucune alerte</p>
          <p className="text-sm text-muted-foreground mt-1">Rien à traiter pour ce filtre.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>{["Transaction","Montant","Canal","Score","Risque","Statut","Date",""].map((h,i)=>(
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {alerts.map(alert=>(
                <tr key={alert.id} onClick={()=>setSelected(alert)} className="hover:bg-muted/20 transition-colors cursor-pointer group">
                  <td className="px-4 py-3 font-mono text-xs">{alert.transaction_id.slice(0,14)}…</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-foreground">{alert.amount.toLocaleString()} {alert.currency}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{alert.channel}</td>
                  <td className="px-4 py-3 text-xs font-mono text-foreground">{(alert.score*100).toFixed(0)}%</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${RISK_BADGE[alert.risk_level]??""}`}>{alert.risk_level}</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[alert.status]??""}`}>{STATUS_LABEL[alert.status]??alert.status}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(alert.timestamp).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</td>
                  <td className="px-3 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AlertDrawer alert={selected} onClose={()=>setSelected(null)} onStatusChange={handleStatusChange} fetchFn={portalFetch}/>
    </div>
  );
}
