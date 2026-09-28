"use client";

import {
  type InfiniteData,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import type { SearchItem } from "@/lib/types/item";
import {
  type InvalidFilterValue,
  SearchError,
  type SearchParams,
  type SearchResponse,
  search,
} from "./api";
import type { Filter, SearchState } from "./types";

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Show a single toast notification for invalid filter values.
 * Groups invalid values by filter type for a cleaner user experience.
 */
function showInvalidFiltersToast(invalidFilters: InvalidFilterValue[]) {
  if (invalidFilters.length === 0) return;

  // Group by filter type
  const byType = new Map<string, string[]>();
  for (const invalid of invalidFilters) {
    const values = byType.get(invalid.filterType) || [];
    values.push(invalid.value);
    byType.set(invalid.filterType, values);
  }

  // Build message
  const parts: string[] = [];
  for (const [filterType, values] of byType) {
    const quotedValues = values.map((v) => `"${v}"`).join(", ");
    parts.push(`${quotedValues} for ${filterType}`);
  }

  const title =
    invalidFilters.length === 1
      ? "Invalid filter value"
      : "Invalid filter values";

  toast.error(title, {
    description: `${parts.join("; ")}. Valid values are shown in the autocomplete dropdown.`,
  });
}

/** Search params for a query's first page — pagination adds the cursor. */
type SearchQueryParams = Omit<SearchParams, "cursor">;

export type SearchResultsState = {
  isLoading: boolean;
  isSearching: boolean;
  hasReceivedResults: boolean;
  items: SearchItem[];
  total: number;
  cursor: string | null;
  hasMore: boolean;
  error: string | null;
  warnings: SearchResponse["warnings"];
};

/**
 * Convert frontend Filter to API search params.
 */
function buildSearchParams(state: SearchState): SearchQueryParams {
  const params: SearchQueryParams = {};

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
      case "status":
        params.status = values;
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
 * Query key for a search's results. Nested under the `["items"]` namespace so
 * {@link useInvalidateItems} — called after every item edit (reading status,
 * notes, tags…) — refetches the visible results too, not just the full list.
 */
export function searchResultsQueryKey(params: SearchQueryParams) {
  return ["items", "search", params] as const;
}

const NO_PAGES: SearchResponse[] = [];

const sameParams = (a: SearchQueryParams, b: SearchQueryParams) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Hook for fetching search results based on search state.
 *
 * Returns search results that can be used to replace/filter the items grid.
 * Only fetches when there's an active search (query or filters). Results live
 * in the React Query cache under {@link searchResultsQueryKey}, so an item
 * edited from a search result refreshes (or drops out of) the results.
 */
export function useSearchResults(searchState: SearchState) {
  const queryClient = useQueryClient();
  const hasActiveSearch = hasSearchCriteria(searchState);
  const params = useMemo(() => buildSearchParams(searchState), [searchState]);
  const [debouncedParams] = useDebounce(params, SEARCH_DEBOUNCE_MS, {
    equalityFn: sameParams,
  });
  const isDebouncing = !sameParams(params, debouncedParams);

  // Invalid-filter toasts fire once per search, not again on every refetch an
  // item edit triggers. Reset when search clears so re-entering it re-warns.
  const toastedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hasActiveSearch) toastedKeyRef.current = null;
  }, [hasActiveSearch]);

  const query = useInfiniteQuery({
    queryKey: searchResultsQueryKey(debouncedParams),
    queryFn: async ({ pageParam }) => {
      const key = JSON.stringify(debouncedParams);
      const shouldToast = pageParam === null && toastedKeyRef.current !== key;
      try {
        const response = await search({
          ...debouncedParams,
          ...(pageParam ? { cursor: pageParam } : {}),
        });
        if (shouldToast && response.invalidFilters?.length) {
          toastedKeyRef.current = key;
          showInvalidFiltersToast(response.invalidFilters);
        }
        return response;
      } catch (error) {
        if (
          shouldToast &&
          error instanceof SearchError &&
          error.invalidFilters?.length
        ) {
          toastedKeyRef.current = key;
          showInvalidFiltersToast(error.invalidFilters);
        }
        throw error;
      }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor || undefined,
    // Gate on the debounce so a stale key (e.g. `{}` right after re-entering a
    // search) never fires a request
    enabled: hasActiveSearch && !isDebouncing,
    retry: false,
  });

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const loadMore = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) return;
    await fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Patch a single result's title in place across every cached search, so an
  // optimistic rename in the detail dialog updates the visible card at once.
  const patchItemTitle = useCallback(
    (itemId: string, title: string) => {
      queryClient.setQueriesData<InfiniteData<SearchResponse>>(
        { queryKey: ["items", "search"] },
        (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  items: page.items.map((item) =>
                    item.id === itemId ? { ...item, title } : item,
                  ),
                })),
              }
            : old,
      );
    },
    [queryClient],
  );

  const pages = (hasActiveSearch && query.data?.pages) || NO_PAGES;
  const lastPage = pages.at(-1);
  const items = useMemo(() => pages.flatMap((page) => page.items), [pages]);

  return {
    isLoading:
      hasActiveSearch &&
      (isFetchingNextPage || (query.isPending && query.isFetching)),
    // True whenever there's search criteria whose results haven't landed yet —
    // debouncing, or the first fetch for a new query. A background refetch
    // after an item edit doesn't count, so the grid doesn't dim for it.
    isSearching: hasActiveSearch && (isDebouncing || query.isPending),
    hasReceivedResults: pages.length > 0,
    items,
    total: pages[0]?.total ?? 0,
    cursor: lastPage?.cursor ?? null,
    hasMore: hasActiveSearch && hasNextPage,
    error:
      hasActiveSearch && query.error
        ? query.error instanceof Error
          ? query.error.message
          : "Search failed"
        : null,
    warnings: lastPage?.warnings,
    loadMore,
    patchItemTitle,
    hasActiveSearch,
  };
}
