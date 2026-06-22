import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "XOF"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getRiskLabel(score: number, locale = "fr"): string {
  if (score < 0.5) return locale === "fr" ? "Faible" : "Low";
  if (score < 0.7) return locale === "fr" ? "Moyen" : "Medium";
  return locale === "fr" ? "Élevé" : "High";
}

export function getRiskColor(score: number): string {
  if (score < 0.5) return "success";
  if (score < 0.7) return "warning";
  return "danger";
}
