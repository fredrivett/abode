/**
 * Filter a list of facet values by the typed query and rank them by match
 * quality: exact match first, then prefix matches, then substring matches.
 * Ties keep their incoming order (the API returns values alphabetically, and
 * Array.prototype.sort is stable), so "oran" surfaces "orange" above
 * "dark orange" instead of ordering purely by the alphabet.
 */
export function rankFilterValues(values: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return values;
  return values
    .filter((value) => value.toLowerCase().includes(q))
    .sort(
      (a, b) => matchRank(a.toLowerCase(), q) - matchRank(b.toLowerCase(), q),
    );
}

function matchRank(value: string, query: string): number {
  if (value === query) return 0;
  if (value.startsWith(query)) return 1;
  return 2;
}
