import { PortalSidebar } from "@/components/portal/sidebar";
import { Providers } from "@/components/providers";

export const dynamic = "force-dynamic";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex h-screen overflow-hidden bg-background">
        <PortalSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </Providers>
  );
}
