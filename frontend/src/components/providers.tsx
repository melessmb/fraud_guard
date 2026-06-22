"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { useState } from "react";

interface ProvidersProps {
  children: React.ReactNode;
  locale?: string;
  messages?: AbstractIntlMessages;
}

export function Providers({ children, locale = "fr", messages = {} }: ProvidersProps) {
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
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
