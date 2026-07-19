"use client";

import posthog from "posthog-js";
import { useEffect, useMemo, useRef } from "react";
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

/**
 * Live free-text → filter suggestions for a search surface. Runs the pure
 * detection engine against the user's known filter values and captures a
 * "shown" analytics event the first time a non-empty set appears.
 */
export function useFilterSuggestions({
  query,
  filterOptions,
  filters,
  surface,
  enabled = true,
}: UseFilterSuggestionsArgs): Suggestion[] {
  const suggestions = useMemo(
    () =>
      enabled
        ? detectSuggestions(query, filterOptions, filters, new Date())
        : [],
    [enabled, query, filterOptions, filters],
  );

  const shownRef = useRef(false);
  useEffect(() => {
    if (suggestions.length > 0) {
      if (!shownRef.current) {
        shownRef.current = true;
        posthog.capture("search_suggestions_shown", {
          surface,
          count: suggestions.length,
          facets: suggestions.map((s) => s.facet),
        });
      }
    } else {
      shownRef.current = false;
    }
  }, [suggestions, surface]);

  return suggestions;
}
