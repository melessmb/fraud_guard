"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { usePortalSSE } from "@/lib/hooks/use-portal-sse";
import { AlertToastContainer } from "@/components/notifications/alert-toast";

function PortalSSEProvider({ children }: { children: React.ReactNode }) {
  usePortalSSE();
  return (
    <>
      {children}
      <AlertToastContainer />
    </>
  );
}

export function PortalProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PortalSSEProvider>
        {children}
      </PortalSSEProvider>
    </QueryClientProvider>
  );
}
