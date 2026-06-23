"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[FraudGuard error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-12 h-12 text-destructive" />
            </div>
            <span className="absolute -top-2 -right-2 text-3xl font-black text-destructive/20 select-none leading-none">
              500
            </span>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-foreground tracking-tight">Erreur serveur</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Une erreur inattendue s'est produite.
            <br />
            Réessayez ou revenez au tableau de bord.
          </p>
        </div>

        {/* Digest */}
        {error.digest && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs font-mono text-muted-foreground border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            Ref : {error.digest}
          </div>
        )}
        {!error.digest && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs font-mono text-muted-foreground border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            HTTP 500 · Internal Server Error
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm w-full sm:w-auto justify-center">
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
          <Link href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm font-semibold hover:bg-accent transition-colors w-full sm:w-auto justify-center">
            <Home className="w-4 h-4" />
            Tableau de bord
          </Link>
        </div>

        {/* Branding */}
        <p className="text-xs text-muted-foreground/50 pt-2">
          FraudGuard · Plateforme de détection de fraude
        </p>
      </div>
    </div>
  );
}
