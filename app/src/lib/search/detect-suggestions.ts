/**
 * Detect facet-filter suggestions in a free-text search query — the engine
 * behind "type `paris june 2026`, we offer [location:paris] [date:june 2026]".
 *
 * Grounded facets (location/tag/object/color/source/type) are matched only
 * against values that exist in THIS user's data, so we suggest "paris" as a
 * location because they have Paris items — not because we guessed it's a city.
 * Dates go through a small hand-rolled scanner. Pure and deterministic (`now`
 * is injected); the caller decides when to run it and never mutates the query
 * until a suggestion is accepted.
 */
import type { FiltersResponse } from "./api";
import { type DateMatch, findDateExpressions } from "./parse-date-expression";
import type { DateOperator, Filter, FilterType } from "./types";

export type Suggestion = {
  facet: FilterType;
  value: string;
  start: number;
  end: number;
  dateOperator?: DateOperator;
  endDate?: string;
};

// Grounded facets to scan against the user's own values. Order here is
// irrelevant — FACET_PRIORITY decides ranking.
const GROUNDED_FACETS: (keyof FiltersResponse)[] = [
  "location",
  "type",
  "source",
  "tag",
  "object",
  "color",
];

// Ranking when several facets match the same word (lower index = shown first /
// the default Tab row). Most specific/reliable first; tag (any free-text label,
// so the most collision-prone) last.
const FACET_PRIORITY: FilterType[] = [
  "type",
  "date",
  "location",
  "source",
  "object",
  "color",
  "tag",
];

/** Whole-word (space/boundary delimited) occurrences of `value` in `query`. */
function findValueSpans(
  lowerQuery: string,
  value: string,
): Array<{ start: number; end: number }> {
  const needle = value.toLowerCase();
  if (!needle) return [];
  const spans: Array<{ start: number; end: number }> = [];
  let start = lowerQuery.indexOf(needle);
  while (start !== -1) {
    const end = start + needle.length;
    const beforeOk = start === 0 || /\s/.test(lowerQuery[start - 1]);
    const afterOk = end === lowerQuery.length || /\s/.test(lowerQuery[end]);
    if (beforeOk && afterOk) spans.push({ start, end });
    start = lowerQuery.indexOf(needle, start + 1);
  }
  return spans;
}

function isAlreadyApplied(suggestion: Suggestion, filters: Filter[]): boolean {
  return filters.some(
    (f) =>
      f.type === suggestion.facet &&
      f.value.toLowerCase() === suggestion.value.toLowerCase() &&
      f.endDate === suggestion.endDate,
  );
}

export function detectSuggestions(
  query: string,
  options: FiltersResponse | undefined,
  filters: Filter[],
  now: Date,
): Suggestion[] {
  if (!query.trim()) return [];
  const lowerQuery = query.toLowerCase();
  const candidates: Suggestion[] = [];

  // Grounded facet values from the user's own data
  for (const facet of GROUNDED_FACETS) {
    for (const value of options?.[facet] ?? []) {
      for (const span of findValueSpans(lowerQuery, value)) {
        candidates.push({ facet, value, start: span.start, end: span.end });
      }
    }
  }

  // Dates via the hand-rolled scanner
  for (const match of findDateExpressions(query, now)) {
    candidates.push(dateMatchToSuggestion(match));
  }

  const fresh = candidates.filter((c) => !isAlreadyApplied(c, filters));

  // Order: earliest start, then longest span, then facet priority.
  fresh.sort(
    (a, b) =>
      a.start - b.start ||
      b.end - b.start - (a.end - a.start) ||
      FACET_PRIORITY.indexOf(a.facet) - FACET_PRIORITY.indexOf(b.facet),
  );

  // Drop matches that partially overlap an already-selected one (e.g. "york"
  // inside "new york"), but KEEP alternatives covering the exact same word so
  // an ambiguous token like "orange" can offer both its colour and tag.
  const selected: Suggestion[] = [];
  for (const candidate of fresh) {
    const conflicts = selected.some((s) => {
      const sameSpan = s.start === candidate.start && s.end === candidate.end;
      const overlaps = candidate.start < s.end && s.start < candidate.end;
      return overlaps && !sameSpan;
    });
    if (!conflicts) selected.push(candidate);
  }

  return selected;
}

function dateMatchToSuggestion(match: DateMatch): Suggestion {
  return {
    // value is the ISO date so it serializes correctly and renders through the
    // chip's date formatter (e.g. a whole-month range collapses to "June 2026")
    facet: "date",
    value: match.value,
    start: match.start,
    end: match.end,
    dateOperator: match.operator,
    endDate: match.endDate,
  };
}

/**
 * Remove a suggestion's matched span from the query, collapsing the leftover
 * whitespace so the remaining text stays clean.
 */
export function removeSpan(query: string, start: number, end: number): string {
  return `${query.slice(0, start)} ${query.slice(end)}`
    .replace(/\s+/g, " ")
    .trim();
}
