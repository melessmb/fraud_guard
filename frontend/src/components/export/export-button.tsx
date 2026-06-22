"use client";

import { useState } from "react";
import { Download, Loader2, ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api/fetch";

interface ExportConfig {
  label: string;
  url: string;
  filename?: string;
}

interface Props {
  exports: ExportConfig[];
  disabled?: boolean;
}

async function downloadCsv(url: string, filename: string) {
  const res = await apiFetch(url);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail ?? `Erreur ${res.status}`);
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

export function ExportButton({ exports, disabled }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const handleExport = async (cfg: ExportConfig) => {
    setOpen(false);
    setError("");
    setLoading(cfg.label);
    try {
      const filename = cfg.filename ?? `export_${Date.now()}.csv`;
      await downloadCsv(cfg.url, filename);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'export");
    } finally {
      setLoading(null);
    }
  };

  // Un seul export → bouton simple
  if (exports.length === 1) {
    const cfg = exports[0];
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => handleExport(cfg)}
          disabled={disabled || loading !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {loading ? "Export…" : "Exporter CSV"}
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  // Plusieurs exports → dropdown
  return (
    <div className="relative flex flex-col items-end gap-1">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled || loading !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {loading ?? "Exporter"}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-background border border-border rounded-xl shadow-lg overflow-hidden z-20">
          {exports.map(cfg => (
            <button
              key={cfg.label}
              onClick={() => handleExport(cfg)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors text-left"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              {cfg.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
