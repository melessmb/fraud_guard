"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[FraudGuard global error]", error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4 font-sans antialiased">
        <div className="max-w-md w-full text-center space-y-6">

          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-2xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Erreur critique</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              L'application a rencontré une erreur critique.
              <br />
              Veuillez actualiser la page.
            </p>
          </div>

          {error.digest && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-xs font-mono text-gray-500 border border-gray-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Ref : {error.digest}
            </div>
          )}

          <button onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors shadow-sm">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>

          <p className="text-xs text-gray-400 pt-2">
            FraudGuard · Plateforme de détection de fraude
          </p>
        </div>
      </body>
    </html>
  );
}
