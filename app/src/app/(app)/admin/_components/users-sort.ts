// Single source of truth for the admin users table's sortable columns, shared
// by the page (allowlist + orderBy mapping) and the table (typed headers) so a
// header, the allowlist, and the query can't drift apart.
//
// The derived "last active" / "last item added" columns are per-page aggregates
// and aren't sortable, so they're intentionally absent here.
export const USER_SORT_COLUMNS = [
  "user",
  "username",
  "items",
  "rooms",
  "storage",
  "joined",
] as const;

export type UserSortColumn = (typeof USER_SORT_COLUMNS)[number];
