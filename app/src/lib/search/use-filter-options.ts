"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { type FiltersResponse, getFilterValues } from "./api";
import type { FilterType } from "./types";

// Query key for the filter options cache, exported for consistent invalidation
export const FILTER_OPTIONS_QUERY_KEY = ["filter-options"] as const;

// Cache for 5 minutes, consider stale after 1 minute
const STALE_TIME = 60 * 1000;
const GC_TIME = 5 * 60 * 1000;

/**
 * Hook for fetching and caching all filter options.
 *
 * - Fetches all filter values on mount
 * - Caches for 5 minutes
 * - Returns a function to get values for a specific type from cache
 */
export function useFilterOptions() {
  const { data, isLoading, error } = useQuery<FiltersResponse>({
    queryKey: FILTER_OPTIONS_QUERY_KEY,
    queryFn: () => getFilterValues(),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

  /**
   * Get filter values for a specific type from cache.
   * Returns immediately from cache if available.
   */
  const getFilterValuesForType = async (
    type: FilterType,
  ): Promise<string[]> => {
    if (!data) {
      // If data isn't loaded yet, fall back to fetching
      const response = await getFilterValues(type);
      return response[type as keyof FiltersResponse] || [];
    }

    return data[type as keyof FiltersResponse] || [];
  };

  return {
    filterOptions: data,
    isLoading,
    error,
    getFilterValuesForType,
  };
}

/**
 * Returns a stable callback that invalidates the filter options cache.
 * Filter values (kind, source, tags, objects, colors, locations) are derived
 * from the user's items, so they go stale when an item is created or when
 * background analysis classifies it (e.g. a URL resolves to a `book`).
 */
export function useInvalidateFilterOptions() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: FILTER_OPTIONS_QUERY_KEY }),
    [queryClient],
  );
}
