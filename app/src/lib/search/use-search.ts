"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptySearchState,
  FILTER_TYPES,
  type Filter,
  parseSearchParams,
  type SearchState,
  serializeSearchParams,
} from "./types";

const DEBOUNCE_MS = 300;

/** Params the search owns in the URL: the free-text query plus one per filter type */
const SEARCH_PARAM_KEYS = ["q", ...Object.keys(FILTER_TYPES)];

/** `search` with its search-owned params replaced by `state`'s, others kept. */
export function replaceSearchParams({
  search,
  state,
}: {
  search: string;
  state: SearchState;
}): string {
  const params = new URLSearchParams(search);
  for (const key of SEARCH_PARAM_KEYS) params.delete(key);
  for (const [key, value] of serializeSearchParams(state)) {
    params.append(key, value);
  }
  return params.toString();
}

/**
 * Hook for managing search state with URL synchronization.
 *
 * - Local state is the source of truth for the UI
 * - URL is updated after debounce (write-only during typing)
 * - URL is only read on initial mount and browser back/forward
 */
export function useSearch() {
  const searchParams = useSearchParams();

  // The search-owned slice of the URL (query + filters), normalized the same
  // way writeUrl serializes it. Other params (`?item=` for the open dialog,
  // `?debug=`) aren't search state: reacting to them would re-parse the URL
  // into a "new" state (fresh filter ids), re-run the search and reset its
  // pagination — e.g. opening an item from page 3 of a filtered view dropped
  // it from the results, unmounting and remounting its dialog.
  const urlSearchKey = serializeSearchParams(
    parseSearchParams(searchParams),
  ).toString();

  // Parse initial URL state on mount only
  const [state, setLocalState] = useState<SearchState>(() =>
    parseSearchParams(searchParams),
  );

  // The search key we last wrote or synced from, so we don't react to our own
  // changes (seeded with the initial URL, which the initial state came from)
  const lastUrlRef = useRef<string | null>(urlSearchKey);

  // Debounced URL update
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle external search changes (browser back/forward, or another useSearch
  // instance writing the URL — e.g. clicking a chip in the item dialog)
  useEffect(() => {
    // If this URL matches what we set, ignore it (our own update)
    if (lastUrlRef.current === urlSearchKey) {
      return;
    }
    lastUrlRef.current = urlSearchKey;

    // A pending debounced write is now stale — the external change supersedes
    // it. Drop it so it can't clobber the URL after we sync (e.g. a chip's
    // immediate write being overwritten by the header's typed-query timer).
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setLocalState(parseSearchParams(new URLSearchParams(urlSearchKey)));
  }, [urlSearchKey]);

  const writeUrl = useCallback(
    ({
      state: newState,
      keepOtherParams,
    }: {
      state: SearchState;
      keepOtherParams: boolean;
    }) => {
      const searchKey = serializeSearchParams(newState).toString();
      const queryString = keepOtherParams
        ? replaceSearchParams({
            search: window.location.search,
            state: newState,
          })
        : searchKey;
      const url = queryString ? `?${queryString}` : window.location.pathname;

      // Track this URL so we ignore the popstate event
      lastUrlRef.current = searchKey;

      // Use history.replaceState to update URL without triggering navigation
      window.history.replaceState(null, "", url);
    },
    [],
  );

  // Update the URL. Debounced by default (write-only during typing); pass
  // `immediate` for discrete actions (e.g. clicking a chip) that may unmount
  // this hook right after — a pending debounce would be cancelled on unmount
  // and the URL never written.
  //
  // An immediate write replaces the whole query string: it's a discrete new
  // search that replaces the view (a chip click relies on it dropping `?item=`
  // to close the dialog). A debounced write lands up to DEBOUNCE_MS later, when
  // the user may have moved on (e.g. opened an item), so it only replaces the
  // search-owned params and keeps the rest.
  const updateUrl = useCallback(
    (newState: SearchState, immediate = false) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (immediate) {
        writeUrl({ state: newState, keepOtherParams: false });
        return;
      }

      timeoutRef.current = setTimeout(() => {
        writeUrl({ state: newState, keepOtherParams: true });
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
