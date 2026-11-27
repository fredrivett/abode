import { useQuery } from "@tanstack/react-query";
import { useIsOnline } from "@/hooks/use-is-online";
import { api } from "@/lib/api-client";
import { useOfflineLibrary } from "@/lib/offline/offline-library-context";
import type { Item } from "@/lib/types/item";

/**
 * Query key for a single item's detail fetch. Nested under the `["items"]`
 * namespace, so invalidating that prefix refreshes an open detail alongside the
 * list, and deleting the item drops it with its other per-item queries.
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
 *
 * While offline, once the offline library has synced, the item is read from it
 * instead (an item it doesn't hold fails the query, as a missing item does).
 *
 * @param itemId - The item to fetch, or null when there's nothing open.
 * @param enabled - Pass `false` to defer the fetch (e.g. the item is already
 *   in the loaded list, so no network round-trip is needed).
 */
export function useItem(itemId: string | null, enabled = true) {
  const offlineLibrary = useOfflineLibrary();
  const isOnline = useIsOnline();
  const store = isOnline ? null : (offlineLibrary?.store ?? null);
  return useQuery<Item>({
    queryKey: itemQueryKey(itemId ?? ""),
    queryFn: store
      ? async () => {
          const item = itemId ? await store.getItem(itemId) : null;
          if (!item) throw new Error("Not in the offline library");
          return item;
        }
      : () => api.get(`/api/v1/items/${itemId}`),
    enabled: enabled && itemId !== null,
    // A local read runs with no connection; the server fetch waits for one
    ...(store && { networkMode: "always", retry: false }),
  });
}
