"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { api, ApiClientError } from "./api-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              // Don't retry on auth errors or client errors (4xx)
              if (error instanceof ApiClientError && error.status < 500) {
                return false;
              }
              // Retry up to 2 times for server errors (5xx) or network issues
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
            queryFn: async ({ queryKey }) => {
              const [url] = queryKey as [string, ...unknown[]];
              return api.get(url);
            },
          },
          mutations: {
            retry: (failureCount, error) => {
              // Only retry mutations on 429 (rate limit) or 5xx errors
              if (error instanceof ApiClientError) {
                return error.status === 429 || error.status >= 500 ? failureCount < 1 : false;
              }
              return false;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
