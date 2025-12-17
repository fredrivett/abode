"use client";

import { useQuery } from "@tanstack/react-query";
import { type FiltersResponse, getFilterValues } from "./api";
import type { FilterType } from "./types";

const FILTER_OPTIONS_QUERY_KEY = "filter-options";

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
    queryKey: [FILTER_OPTIONS_QUERY_KEY],
    queryFn: () => getFilterValues(),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

  /**
   * Get filter values for a specific type from cache.
   * Returns immediately from cache if available.
   */
  const getFilterValuesForType = async (type: FilterType): Promise<string[]> => {
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
