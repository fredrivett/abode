export type SortDirection = "asc" | "desc";

export type SortState = {
  /** Active sort column key, or null when unsorted */
  column: string | null;
  direction: SortDirection;
};

/**
 * Parse `sort` / `dir` query params into a validated {@link SortState}. Any
 * column not in `allowedColumns` is ignored (guards against arbitrary values
 * reaching a query's `orderBy`). Direction defaults to `asc`.
 */
export function parseSortParams(
  params: { sort?: string | null; dir?: string | null },
  allowedColumns: readonly string[],
): SortState {
  const column =
    params.sort && allowedColumns.includes(params.sort) ? params.sort : null;
  const direction: SortDirection = params.dir === "desc" ? "desc" : "asc";
  return { column, direction };
}

/**
 * Next state when a header is clicked, cycling the column through
 * asc → desc → unset (and starting a freshly-clicked column at asc).
 */
export function nextSortState(current: SortState, column: string): SortState {
  if (current.column !== column) return { column, direction: "asc" };
  if (current.direction === "asc") return { column, direction: "desc" };
  return { column: null, direction: "asc" };
}

/**
 * Build the query params for a sort change: writes/removes `sort` & `dir`,
 * preserves all other params (e.g. `search`), and resets `page` so the user
 * lands on the first page of the newly-sorted results.
 */
export function buildSortQuery(
  currentParams: URLSearchParams,
  next: SortState,
): URLSearchParams {
  const params = new URLSearchParams(currentParams);
  params.delete("page");
  if (next.column) {
    params.set("sort", next.column);
    params.set("dir", next.direction);
  } else {
    params.delete("sort");
    params.delete("dir");
  }
  return params;
}
