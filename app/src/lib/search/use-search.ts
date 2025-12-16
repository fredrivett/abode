"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type SearchState,
  type Filter,
  parseSearchParams,
  serializeSearchParams,
} from "./types";

const DEBOUNCE_MS = 300;

/**
 * Hook for managing search state with URL synchronization.
 *
 * - Local state is the source of truth for the UI
 * - URL is updated after debounce (write-only during typing)
 * - URL is only read on initial mount and browser back/forward
 */
export function useSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Track if we initiated the URL change (vs browser back/forward)
  const isInternalUpdate = useRef(false);

  // Parse initial URL state on mount only
  const [state, setLocalState] = useState<SearchState>(() =>
    parseSearchParams(searchParams)
  );

  // Handle browser back/forward navigation
  useEffect(() => {
    // If we initiated the change, ignore it
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    // External navigation (back/forward) - sync from URL
    const urlState = parseSearchParams(searchParams);
    setLocalState(urlState);
  }, [searchParams]);

  // Debounced URL update
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateUrl = useCallback(
    (newState: SearchState) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const params = serializeSearchParams(newState);
        const queryString = params.toString();
        const url = queryString ? `?${queryString}` : window.location.pathname;

        // Mark this as our update so we ignore the resulting searchParams change
        isInternalUpdate.current = true;
        router.replace(url, { scroll: false });
      }, DEBOUNCE_MS);
    },
    [router]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Update local state immediately, debounce URL update
  const setState = useCallback(
    (newState: SearchState) => {
      setLocalState(newState);
      updateUrl(newState);
    },
    [updateUrl]
  );

  // Convenience methods
  const setQuery = useCallback(
    (query: string) => {
      const newState = { ...state, query };
      setLocalState(newState);
      updateUrl(newState);
    },
    [state, updateUrl]
  );

  const addFilter = useCallback(
    (filter: Filter) => {
      const newState = {
        ...state,
        filters: [...state.filters, filter],
      };
      setLocalState(newState);
      updateUrl(newState);
    },
    [state, updateUrl]
  );

  const removeFilter = useCallback(
    (id: string) => {
      const newState = {
        ...state,
        filters: state.filters.filter((f) => f.id !== id),
      };
      setLocalState(newState);
      updateUrl(newState);
    },
    [state, updateUrl]
  );

  const clearFilters = useCallback(() => {
    const newState = { ...state, filters: [] };
    setLocalState(newState);
    updateUrl(newState);
  }, [state, updateUrl]);

  const clearAll = useCallback(() => {
    const newState = { query: "", filters: [] };
    setLocalState(newState);
    updateUrl(newState);
  }, [updateUrl]);

  const hasActiveSearch = state.query.length > 0 || state.filters.length > 0;

  return {
    state,
    setState,
    setQuery,
    addFilter,
    removeFilter,
    clearFilters,
    clearAll,
    hasActiveSearch,
  };
}
