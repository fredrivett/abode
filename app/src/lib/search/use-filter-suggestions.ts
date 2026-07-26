"use client";

import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FiltersResponse } from "./api";
import { detectSuggestions, type Suggestion } from "./detect-suggestions";
import type { Filter } from "./types";

type UseFilterSuggestionsArgs = {
  query: string;
  filterOptions: FiltersResponse | undefined;
  filters: Filter[];
  /** Where the suggestions surface (for analytics): "search-input" | "command-palette". */
  surface: string;
  /** Gate detection off while an @-dropdown/date picker is open, input is disabled, etc. */
  enabled?: boolean;
};

type UseFilterSuggestionsResult = {
  suggestions: Suggestion[];
  /** Call when a suggestion is accepted, so the shown session isn't counted as dismissed. */
  markAccepted: () => void;
};

/**
 * Live free-text → filter suggestions for a search surface. Runs the pure
 * detection engine against the user's known filter values and captures the
 * analytics funnel: "shown" when a non-empty set first appears, then either
 * "accepted" (the caller reports it via markAccepted) or "dismissed" when the
 * set goes away without any accept.
 */
export function useFilterSuggestions({
  query,
  filterOptions,
  filters,
  surface,
  enabled = true,
}: UseFilterSuggestionsArgs): UseFilterSuggestionsResult {
  // Debounce so detection doesn't run on every keystroke — matching a query
  // against all of the user's known values is O(values) and, run synchronously
  // in the keystroke render, makes typing feel laggy.
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const suggestions = useMemo(
    () =>
      enabled
        ? detectSuggestions(debouncedQuery, filterOptions, filters, new Date())
        : [],
    [enabled, debouncedQuery, filterOptions, filters],
  );

  const shownRef = useRef(false);
  const acceptedRef = useRef(false);
  useEffect(() => {
    if (suggestions.length > 0) {
      if (!shownRef.current) {
        shownRef.current = true;
        acceptedRef.current = false; // start of a fresh shown session
        posthog.capture("search_suggestions_shown", {
          surface,
          count: suggestions.length,
          facets: suggestions.map((s) => s.facet),
        });
      }
    } else if (shownRef.current) {
      // the shown session ended — dismissed if nothing was accepted in it
      shownRef.current = false;
      if (!acceptedRef.current) {
        posthog.capture("search_suggestions_dismissed", { surface });
      }
      acceptedRef.current = false;
    }
  }, [suggestions, surface]);

  // If the surface tears down while a shown session is still open (e.g. the
  // palette closes or the page unmounts), count it as dismissed so the session
  // still gets a terminal event.
  useEffect(() => {
    return () => {
      if (shownRef.current && !acceptedRef.current) {
        posthog.capture("search_suggestions_dismissed", { surface });
      }
    };
  }, [surface]);

  const markAccepted = useCallback(() => {
    acceptedRef.current = true;
  }, []);

  return { suggestions, markAccepted };
}
