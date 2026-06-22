import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { getLocale, getMessages } from "next-intl/server";

// All dashboard pages are dynamic (authenticated, user-specific)
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const locale   = await getLocale();
  const messages = await getMessages();

  return (
    <Providers locale={locale} messages={messages}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </Providers>
  );
}
