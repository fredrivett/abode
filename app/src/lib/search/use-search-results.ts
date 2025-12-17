"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type SearchResponse, type SearchResultItem, search } from "./api";
import type { Filter, SearchState } from "./types";

const SEARCH_DEBOUNCE_MS = 250;

export type SearchResultsState = {
  isLoading: boolean;
  isSearching: boolean;
  items: SearchResultItem[];
  total: number;
  cursor: string | null;
  hasMore: boolean;
  error: string | null;
  warnings: SearchResponse["warnings"];
};

/**
 * Convert frontend Filter to API search params.
 */
function buildSearchParams(state: SearchState): {
  q?: string;
  type?: string[];
  tag?: string[];
  object?: string[];
  color?: string[];
  source?: string[];
  location?: string[];
  dateAfter?: string;
  dateBefore?: string;
} {
  const params: ReturnType<typeof buildSearchParams> = {};

  // Add query if present (strip incomplete filter syntax)
  const cleanQuery = state.query
    .replace(/@\w*:?[^\s]*$/, "") // Remove trailing @type:value
    .trim();

  if (cleanQuery) {
    params.q = cleanQuery;
  }

  // Group filters by type
  const filtersByType = new Map<string, Filter[]>();
  for (const filter of state.filters) {
    const existing = filtersByType.get(filter.type) || [];
    existing.push(filter);
    filtersByType.set(filter.type, existing);
  }

  // Convert filters to API format
  for (const [type, filters] of filtersByType) {
    const values = filters.map((f) => (f.negated ? `!${f.value}` : f.value));

    switch (type) {
      case "type":
        params.type = values;
        break;
      case "tag":
        params.tag = values;
        break;
      case "object":
        params.object = values;
        break;
      case "color":
        params.color = values;
        break;
      case "source":
        params.source = values;
        break;
      case "location":
        params.location = values;
        break;
      case "date":
        // Date filters are handled specially
        for (const filter of filters) {
          if (filter.dateOperator === "after") {
            params.dateAfter = filter.value;
          } else if (filter.dateOperator === "before") {
            params.dateBefore = filter.value;
          } else if (filter.dateOperator === "between" && filter.endDate) {
            params.dateAfter = filter.value;
            params.dateBefore = filter.endDate;
          } else if (filter.dateOperator === "is") {
            // Exact date: set both to same day
            params.dateAfter = filter.value;
            params.dateBefore = filter.value;
          }
        }
        break;
    }
  }

  return params;
}

/**
 * Check if search state has any active search criteria.
 */
function hasSearchCriteria(state: SearchState): boolean {
  const cleanQuery = state.query.replace(/@\w*:?[^\s]*$/, "").trim();

  return cleanQuery.length > 0 || state.filters.length > 0;
}

/**
 * Hook for fetching search results based on search state.
 *
 * Returns search results that can be used to replace/filter the items grid.
 * Only fetches when there's an active search (query or filters).
 */
export function useSearchResults(searchState: SearchState) {
  const [state, setState] = useState<SearchResultsState>({
    isLoading: false,
    isSearching: false,
    items: [],
    total: 0,
    cursor: null,
    hasMore: false,
    error: null,
    warnings: undefined,
  });

  // Track current request to avoid stale responses
  const currentRequestId = useRef(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Perform search
  const doSearch = useCallback(
    async (
      searchParams: ReturnType<typeof buildSearchParams>,
      requestId: number,
    ) => {
      try {
        const response = await search(searchParams);

        // Check if this is still the current request
        if (requestId !== currentRequestId.current) {
          return;
        }

        setState({
          isLoading: false,
          isSearching: false,
          items: response.items,
          total: response.total,
          cursor: response.cursor || null,
          hasMore: !!response.cursor,
          error: null,
          warnings: response.warnings,
        });
      } catch (error) {
        // Check if this is still the current request
        if (requestId !== currentRequestId.current) {
          return;
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isSearching: false,
          error: error instanceof Error ? error.message : "Search failed",
        }));
      }
    },
    [],
  );

  // Effect to perform search when state changes
  useEffect(() => {
    // Clear any pending debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Check if we have search criteria
    if (!hasSearchCriteria(searchState)) {
      // Reset state when no search is active
      setState({
        isLoading: false,
        isSearching: false,
        items: [],
        total: 0,
        cursor: null,
        hasMore: false,
        error: null,
        warnings: undefined,
      });
      return;
    }

    // Build search params
    const params = buildSearchParams(searchState);

    // Set loading state
    setState((prev) => ({
      ...prev,
      isSearching: true,
    }));

    // Increment request ID
    currentRequestId.current += 1;
    const requestId = currentRequestId.current;

    // Debounce the actual search
    debounceTimeoutRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
      }));
      void doSearch(params, requestId);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchState, doSearch]);

  // Load more results
  const loadMore = useCallback(async () => {
    if (!state.cursor || state.isLoading) {
      return;
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
    }));

    currentRequestId.current += 1;
    const requestId = currentRequestId.current;

    const params = {
      ...buildSearchParams(searchState),
      cursor: state.cursor,
    };

    try {
      const response = await search(params);

      if (requestId !== currentRequestId.current) {
        return;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        items: [...prev.items, ...response.items],
        cursor: response.cursor || null,
        hasMore: !!response.cursor,
        warnings: response.warnings,
      }));
    } catch (error) {
      if (requestId !== currentRequestId.current) {
        return;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load more",
      }));
    }
  }, [state.cursor, state.isLoading, searchState]);

  const hasActiveSearch = hasSearchCriteria(searchState);

  return {
    ...state,
    loadMore,
    hasActiveSearch,
    // isSearching should be true whenever we have search criteria but haven't received results yet
    // This covers the gap between searchState changing and the effect setting isSearching
    isSearching:
      hasActiveSearch && (state.isSearching || state.items.length === 0),
  };
}
