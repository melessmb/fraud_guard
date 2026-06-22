"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useSSE } from "@/lib/hooks/use-sse";
import { AlertToastContainer } from "@/components/notifications/alert-toast";

function SSEProvider({ children }: { children: React.ReactNode }) {
  useSSE();
  return (
    <>
      {children}
      <AlertToastContainer />
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SSEProvider>
        {children}
      </SSEProvider>
    </QueryClientProvider>
  );
}
