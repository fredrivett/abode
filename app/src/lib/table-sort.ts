export type SortDirection = "asc" | "desc";

export type SortState<TColumn extends string = string> = {
  /** Active sort column key, or null when unsorted */
  column: TColumn | null;
  direction: SortDirection;
};

/**
 * Parse `sort` / `dir` query params into a validated {@link SortState}. Any
 * column not in `allowedColumns` is ignored (guards against arbitrary values
 * reaching a query's `orderBy`). Direction defaults to `asc`.
 *
 * The `column` is typed to the `allowedColumns` union, so a caller passing a
 * `readonly [...] as const` list gets a narrowed `SortState` it can hand to an
 * exhaustive `orderBy` mapping — keeping the allowlist and the mapping in sync.
 */
export function parseSortParams<TColumn extends string>(
  params: { sort?: string | null; dir?: string | null },
  allowedColumns: readonly TColumn[],
): SortState<TColumn> {
  const column =
    params.sort && (allowedColumns as readonly string[]).includes(params.sort)
      ? (params.sort as TColumn)
      : null;
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
