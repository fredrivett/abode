"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Filter,
  parseSearchParams,
  type SearchState,
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
  const searchParams = useSearchParams();

  // Parse initial URL state on mount only
  const [state, setLocalState] = useState<SearchState>(() =>
    parseSearchParams(searchParams),
  );

  // Track the last URL we set to avoid reacting to our own changes
  const lastUrlRef = useRef<string | null>(null);

  // Handle browser back/forward navigation
  useEffect(() => {
    const currentUrl = searchParams.toString();

    // If this URL matches what we set, ignore it (our own update)
    if (lastUrlRef.current === currentUrl) {
      return;
    }

    // External navigation (back/forward) - sync from URL
    const urlState = parseSearchParams(searchParams);
    setLocalState(urlState);
  }, [searchParams]);

  // Debounced URL update
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateUrl = useCallback((newState: SearchState) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const params = serializeSearchParams(newState);
      const queryString = params.toString();
      const url = queryString ? `?${queryString}` : window.location.pathname;

      // Track this URL so we ignore the popstate event
      lastUrlRef.current = queryString;

      // Use history.replaceState to update URL without triggering navigation
      window.history.replaceState(null, "", url);
    }, DEBOUNCE_MS);
  }, []);

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
    [updateUrl],
  );

  // Convenience methods
  const setQuery = useCallback(
    (query: string) => {
      const newState = { ...state, query };
      setLocalState(newState);
      updateUrl(newState);
    },
    [state, updateUrl],
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
    [state, updateUrl],
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
    [state, updateUrl],
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
