/**
 * Search API client for frontend integration.
 *
 * Provides typed fetch functions for:
 * - /api/v1/search - Search and filter items
 * - /api/v1/filters - Get available filter values for autocomplete
 */

import type { FilterType } from "./types";

// Response types matching the API

export type MatchReason = {
  field: string | null;
  value?: string;
  snippet?: string;
  proximity?: number;
};

export type ItemLocation = {
  id: string;
  source: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  formatted: string | null;
};

export type ArticleDetails = {
  author: string | null;
  domain: string | null;
  publishedAt: string | null;
  readingTime: number | null;
  content: string | null;
};

export type SearchResultItem = {
  id: string;
  kind: string | null;
  processingStatus: string;
  fileKey: string | null;
  coverFileKey: string | null;
  meta: Record<string, unknown> | null;
  sourceType: string | null;
  sourceUrl: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  objects: string[];
  colors: Array<{ hex: string; percentage: number; name?: string }> | null;
  ocrText: string | null;
  locations: ItemLocation[];
  articleDetails: ArticleDetails | null;
  createdAt: string;
  match: {
    reasons: MatchReason[];
  };
};

export type SearchWarning =
  | "vector_search_unavailable"
  | "rate_limited"
  | "partial_results"
  | "slow_query";

export type InvalidFilterValue = {
  filterType: string;
  value: string;
  reason: string;
};

export type SearchResponse = {
  items: SearchResultItem[];
  total: number;
  cursor?: string;
  warnings?: SearchWarning[];
  invalidFilters?: InvalidFilterValue[];
};

export type FiltersResponse = {
  tag?: string[];
  object?: string[];
  color?: string[];
  source?: string[];
  location?: string[];
  type?: string[];
};

export type SearchParams = {
  q?: string;
  type?: string[];
  tag?: string[];
  object?: string[];
  color?: string[];
  source?: string[];
  location?: string[];
  dateAfter?: string;
  dateBefore?: string;
  cursor?: string;
};

/**
 * Build URL search params from search parameters.
 */
function buildSearchParams(params: SearchParams): URLSearchParams {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }

  // Add array params
  const arrayParams = [
    "type",
    "tag",
    "object",
    "color",
    "source",
    "location",
  ] as const;
  for (const key of arrayParams) {
    const values = params[key];
    if (values && values.length > 0) {
      for (const value of values) {
        searchParams.append(key, value);
      }
    }
  }

  if (params.dateAfter) {
    searchParams.set("dateAfter", params.dateAfter);
  }
  if (params.dateBefore) {
    searchParams.set("dateBefore", params.dateBefore);
  }
  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }

  return searchParams;
}

/**
 * Custom error class that can carry invalid filter information.
 */
export class SearchError extends Error {
  invalidFilters?: InvalidFilterValue[];

  constructor(message: string, invalidFilters?: InvalidFilterValue[]) {
    super(message);
    this.name = "SearchError";
    this.invalidFilters = invalidFilters;
  }
}

export async function search(params: SearchParams): Promise<SearchResponse> {
  const searchParams = buildSearchParams(params);
  const response = await fetch(`/api/v1/search?${searchParams.toString()}`);

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      throw new SearchError(
        `Rate limited. Try again in ${retryAfter || "a few"} seconds.`,
      );
    }
    if (response.status === 401) {
      throw new SearchError("Unauthorized. Please sign in.");
    }
    const data = await response.json().catch(() => ({}));
    throw new SearchError(
      data.message || `Search failed with status ${response.status}`,
      data.invalidFilters,
    );
  }

  return response.json();
}

/**
 * Get available filter values for autocomplete.
 *
 * @param type - Optional filter type to get values for (omit for all types)
 * @returns Filter values grouped by type
 * @throws Error if the request fails
 */
export async function getFilterValues(
  type?: FilterType,
): Promise<FiltersResponse> {
  const url =
    type !== undefined ? `/api/v1/filters?type=${type}` : "/api/v1/filters";
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      throw new Error(
        `Rate limited. Try again in ${retryAfter || "a few"} seconds.`,
      );
    }
    if (response.status === 401) {
      throw new Error("Unauthorized. Please sign in.");
    }
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.message || `Filters fetch failed with status ${response.status}`,
    );
  }

  return response.json();
}
