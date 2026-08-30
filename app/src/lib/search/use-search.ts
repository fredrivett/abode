"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptySearchState,
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

  // Debounced URL update
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle external URL changes (browser back/forward, or another useSearch
  // instance writing the URL — e.g. clicking a chip in the item dialog)
  useEffect(() => {
    const currentUrl = searchParams.toString();

    // If this URL matches what we set, ignore it (our own update)
    if (lastUrlRef.current === currentUrl) {
      return;
    }

    // A pending debounced write is now stale — the external change supersedes
    // it. Drop it so it can't clobber the URL after we sync (e.g. a chip's
    // immediate write being overwritten by the header's typed-query timer).
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const urlState = parseSearchParams(searchParams);
    setLocalState(urlState);
  }, [searchParams]);

  const writeUrl = useCallback((newState: SearchState) => {
    const params = serializeSearchParams(newState);
    const queryString = params.toString();
    const url = queryString ? `?${queryString}` : window.location.pathname;

    // Track this URL so we ignore the popstate event
    lastUrlRef.current = queryString;

    // Use history.replaceState to update URL without triggering navigation
    window.history.replaceState(null, "", url);
  }, []);

  // Update the URL. Debounced by default (write-only during typing); pass
  // `immediate` for discrete actions (e.g. clicking a chip) that may unmount
  // this hook right after — a pending debounce would be cancelled on unmount
  // and the URL never written.
  const updateUrl = useCallback(
    (newState: SearchState, immediate = false) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (immediate) {
        writeUrl(newState);
        return;
      }

      timeoutRef.current = setTimeout(() => {
        writeUrl(newState);
      }, DEBOUNCE_MS);
    },
    [writeUrl],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Update local state immediately, debounce URL update (unless `immediate`)
  const setState = useCallback(
    (newState: SearchState, options?: { immediate?: boolean }) => {
      setLocalState(newState);
      updateUrl(newState, options?.immediate);
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
    const newState = emptySearchState();
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
