"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useState } from "react";
import { Toaster } from "~/components/ui/sonner";

import { trpc } from "~/trpc/client";
import { createTRPCHttpBatchClientClient } from "~/trpc/create-client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 min stale time — form lists, dashboard stats, the current user etc. only
      // change on explicit user action, not passively. Avoids background
      // refetch storms when navigating between pages sharing queries.
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

export const GlobalProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [createTRPCHttpBatchClientClient()],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider queryClient={queryClient} client={trpcClient}>
        {children}
        <Toaster />
      </trpc.Provider>
    </QueryClientProvider>
  );
};
