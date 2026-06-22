"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Cpu, Play, RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { ModelVersionResponse } from "@/types/api";

function StageBadge({ stage }: { stage: string }) {
  if (stage === "Production") return <Badge variant="success">Production</Badge>;
  if (stage === "Staging")    return <Badge variant="warning">Staging</Badge>;
  if (stage === "Archived")   return <Badge variant="secondary">Archivé</Badge>;
  return <Badge variant="outline">{stage}</Badge>;
}

export default function ModelesPage() {
  const qc = useQueryClient();
  const [trainStatus, setTrainStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [trainMsg, setTrainMsg] = useState("");

  const { data: versions = [], isLoading } = useQuery<ModelVersionResponse[]>({
    queryKey: ["model-versions"],
    queryFn: async () => {
      const res = await fetch("/api/v1/model/versions", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const trainMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/model/train", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Erreur");
      return res.json();
    },
    onMutate:  () => { setTrainStatus("running"); setTrainMsg("Entraînement en cours en arrière-plan…"); },
    onSuccess: (d) => { setTrainStatus("done");    setTrainMsg(d.message ?? "Entraînement lancé."); qc.invalidateQueries({ queryKey: ["model-versions"] }); },
    onError:   (e: any) => { setTrainStatus("error"); setTrainMsg(e.message); },
  });

  const production = versions.find((v) => v.stage === "Production");

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Modèles ML" subtitle="Gestion des versions du modèle de détection" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Active model banner */}
        {production && (
          <div className="flex items-center gap-4 px-5 py-4 rounded-xl border border-green-200 dark:border-green-900/30 bg-green-50 dark:bg-green-950/10">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                Modèle en production : {production.version}
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                {production.description} · AUC-ROC : {production.auc_roc ? (production.auc_roc * 100).toFixed(1) + "%" : "—"}
              </p>
            </div>
          </div>
        )}

        {/* Train button */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Entraîner un nouveau modèle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Lance un entraînement LightGBM sur les données historiques. Le processus tourne en arrière-plan
              (5–15 min). Le nouveau modèle passe automatiquement en <strong>Staging</strong> ; la promotion en
              Production est manuelle.
            </p>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => trainMutation.mutate()}
                loading={trainStatus === "running"}
                disabled={trainStatus === "running"}
              >
                <Play className="w-4 h-4" />
                {trainStatus === "running" ? "Entraînement en cours…" : "Lancer l'entraînement"}
              </Button>
              <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["model-versions"] })}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
            {trainStatus !== "idle" && (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                trainStatus === "done"    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-400" :
                trainStatus === "error"   ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-destructive" :
                "bg-muted border-border text-muted-foreground"
              }`}>
                {trainStatus === "running" ? <Clock className="w-3.5 h-3.5 animate-spin" /> :
                 trainStatus === "done"    ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 <AlertCircle className="w-3.5 h-3.5" />}
                {trainMsg}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Version table */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des versions</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Chargement…</div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                <Cpu className="w-8 h-8 opacity-20" />
                <p className="text-sm">Aucune version disponible.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Version", "Stage", "AUC-ROC", "Description", "Créé le"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.version} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-foreground">{v.version}</td>
                      <td className="px-5 py-3"><StageBadge stage={v.stage} /></td>
                      <td className="px-5 py-3 text-xs font-semibold text-foreground">
                        {v.auc_roc ? (v.auc_roc * 100).toFixed(1) + "%" : "—"}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground max-w-48 truncate">{v.description}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(v.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
