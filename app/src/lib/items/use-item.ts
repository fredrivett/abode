import { useQuery } from "@tanstack/react-query";
import { api, isSensitiveLockedError } from "@/lib/api-client";
import type { Item } from "@/lib/types/item";

/**
 * Query key for a single item's detail fetch. Nested under the `["items"]`
 * namespace so {@link useInvalidateItems} (which invalidates by that prefix)
 * refreshes an open detail alongside the list.
 */
export function itemQueryKey(itemId: string) {
  return ["items", itemId, "detail"] as const;
}

/**
 * Fetches a single item by id (`GET /api/v1/items/:id`, owner-scoped).
 *
 * Used to resolve an open item that isn't in the loaded grid list — e.g. a
 * "similar images" click to an item that's filtered out or beyond page one —
 * so the shared detail dialog can render it without depending on a grid card.
 * Also the only way a sensitive item's content reaches the client: lists carry
 * a redacted placeholder, and this fetch fails with a sensitive-locked error
 * (see `isSensitiveLockedError`) until the owner unlocks.
 *
 * @param itemId - The item to fetch, or null when there's nothing open.
 * @param enabled - Pass `false` to defer the fetch (e.g. the item is already
 *   in the loaded list, so no network round-trip is needed).
 */
export function useItem(itemId: string | null, enabled = true) {
  return useQuery<Item>({
    queryKey: itemQueryKey(itemId ?? ""),
    queryFn: () => api.get(`/api/v1/items/${itemId}`),
    enabled: enabled && itemId !== null,
    // A locked item needs the password, not another try
    retry: (failureCount, error) =>
      !isSensitiveLockedError(error) && failureCount < 3,
  });
}
