/**
 * URL helpers for the item-detail dialog.
 *
 * The open item is addressed by a single `?item=<id>` search param so the dialog
 * survives a refresh, is shareable, and can be closed with the Back button. The
 * param is merged into whatever search/filter params are already present rather
 * than replacing the query string, so the two URL writers (search vs. dialog)
 * don't strip each other's state.
 */

export const ITEM_DIALOG_PARAM = "item";

type ReadableParams = { get(name: string): string | null };

/**
 * Read the open item id from a query string or (Readonly)URLSearchParams.
 *
 * Normalized to lowercase: item ids are UUIDs stored canonically (lowercase) in
 * Postgres, so an uppercase value in a hand-edited/shared URL must be lowered to
 * match the id the client compares against, or the dialog would never open.
 */
export function readItemParam(search: string | ReadableParams): string | null {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  return params.get(ITEM_DIALOG_PARAM)?.toLowerCase() ?? null;
}

/**
 * Merge an open item into the current query string, preserving search/filters.
 * Returns the query string without a leading "?".
 */
export function withOpenItem(search: string, itemId: string): string {
  const params = new URLSearchParams(search);
  params.set(ITEM_DIALOG_PARAM, itemId);
  return params.toString();
}

/**
 * Strip the open-item param, preserving search/filters. Returns the query
 * string without a leading "?".
 */
export function withoutOpenItem(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(ITEM_DIALOG_PARAM);
  return params.toString();
}
