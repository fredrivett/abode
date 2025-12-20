"use client";

import { useMemo } from "react";
import type { Filter } from "@/lib/search/types";
import { useSearchResults } from "@/lib/search/use-search-results";

/**
 * Hook for previewing items that match a set of filters.
 *
 * This is a thin wrapper around useSearchResults that:
 * - Only runs when enabled (e.g., when editing filters)
 * - Works with Filter[] directly (no query string)
 * - Returns a simpler interface for preview use case
 */
export function useFilterPreview(filters: Filter[], enabled: boolean) {
  // Build search state from filters (no query)
  const searchState = useMemo(
    () => ({
      query: "",
      filters: enabled ? filters : [],
    }),
    [filters, enabled],
  );

  const results = useSearchResults(searchState);

  return {
    items: results.items,
    total: results.total,
    isLoading: results.isLoading || results.isSearching,
    hasMore: results.hasMore,
    loadMore: results.loadMore,
    error: results.error,
  };
}
