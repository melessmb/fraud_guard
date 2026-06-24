"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PortalSidebar } from "@/components/portal/sidebar";
import { Providers } from "@/components/providers";
import { usePortalAuthStore } from "@/lib/stores/portal-auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { ShieldCheck, Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

function TenantGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = usePortalAuthStore();
  const { activeTenantId } = useAppStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/portal/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  // Tenant pas encore résolu (ex: rechargement de page sans session)
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

  return <>{children}</>;
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <TenantGuard>
        <div className="flex h-screen overflow-hidden bg-background">
          <PortalSidebar />
          <main className="flex-1 flex flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </TenantGuard>
    </Providers>
  );
}
