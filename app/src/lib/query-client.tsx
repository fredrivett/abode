"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ApiClientError, api } from "./api-client";

/**
 * Provides a shared React Query client to the component tree.
 *
 * Configures default retry behaviour: queries retry up to twice on 5xx/network
 * errors but not on 4xx, and mutations only retry once on 429 or 5xx.
 * The default `queryFn` performs a GET request using the first query-key element
 * as the URL path.
 */
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
                return error.status === 429 || error.status >= 500
                  ? failureCount < 1
                  : false;
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
