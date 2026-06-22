import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FraudGuard — Détection de fraude",
  description: "Plateforme de détection de fraude en temps réel — Afrique de l'Ouest",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full" suppressHydrationWarning>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
