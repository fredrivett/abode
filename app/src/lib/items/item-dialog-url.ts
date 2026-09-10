/**
 * URL helpers for the item-detail dialog.
 *
 * The open item is addressed by a single `?item=<id>` search param so the dialog
 * survives a refresh, is shareable, and can be closed with the Back button. The
 * param is merged into whatever search/filter params are already present rather
 * than replacing the query string, so the two URL writers (search vs. dialog)
 * don't strip each other's state.
 */

import { isCanonicalUuid } from "@/lib/pagination";

export const ITEM_DIALOG_PARAM = "item";

type ReadableParams = { getAll(name: string): string[] };

/**
 * Read the open item id from a query string or (Readonly)URLSearchParams.
 *
 * Validated to match how the server resolves the deep link: a repeated param is
 * ambiguous and treated as no open item, and the value must be a canonical
 * UUID. Item ids are stored canonically (lowercase) in Postgres, so an uppercase
 * value in a hand-edited/shared URL is lowered to match; anything that isn't a
 * UUID returns null, so a malformed link never drives a resolve or by-id fetch.
 */
export function readItemParam(search: string | ReadableParams): string | null {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const all = params.getAll(ITEM_DIALOG_PARAM);
  if (all.length !== 1) return null;
  const id = all[0].toLowerCase();
  return isCanonicalUuid(id) ? id : null;
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
