"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PortalSidebar } from "@/components/portal/sidebar";
import { PortalTopbar } from "@/components/portal/topbar";
import { PortalProviders } from "@/components/portal/providers";
import { usePortalAuthStore } from "@/lib/stores/portal-auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { ShieldCheck, Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/portal":              { title: "Tableau de bord",   subtitle: "Vue d'ensemble de l'activité de détection" },
  "/portal/transactions": { title: "Transactions",       subtitle: "Historique et détail de toutes les transactions" },
  "/portal/alertes":      { title: "Mes alertes",        subtitle: "Alertes fraude générées sur vos transactions" },
  "/portal/analytique":   { title: "Analytique",         subtitle: "Tendances et statistiques de détection" },
  "/portal/scoring":      { title: "Scoring",            subtitle: "Testez le moteur de scoring en temps réel" },
  "/portal/conformite":   { title: "Conformité BCEAO",   subtitle: "Rapports et indicateurs réglementaires" },
  "/portal/configuration":{ title: "Configuration",      subtitle: "Seuils, webhook et clé API" },
  "/portal/regles":       { title: "Règles personnalisées", subtitle: "Définissez vos propres règles de détection de fraude" },
  "/portal/equipe":       { title: "Équipe",             subtitle: "Membres et permissions de votre organisation" },
};

function TenantGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = usePortalAuthStore();
  const { activeTenantId } = useAppStore();

  const meta = PAGE_TITLES[pathname] ?? { title: "Portail", subtitle: "" };

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/portal/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  if (activeTenantId === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Chargement de votre espace…</p>
        <button
          onClick={() => router.replace("/portal/login")}
          className="text-xs text-blue-600 hover:underline mt-2"
        >
          Se reconnecter
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <PortalSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PortalTopbar title={meta.title} subtitle={meta.subtitle} />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalProviders>
      <TenantGuard>
        {children}
      </TenantGuard>
    </PortalProviders>
  );
}
