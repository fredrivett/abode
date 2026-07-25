import { useQuery } from "@tanstack/react-query";
import type { SimilarImagesResponse } from "@/app/api/v1/items/[id]/similar/route";
import { api } from "@/lib/api-client";

function similarImagesQueryKey(itemId: string) {
  return ["items", itemId, "similar"] as const;
}

/**
 * Fetches the owner's images visually similar to `itemId`.
 *
 * @param enabled - Pass `false` to defer fetching until the detail view is open
 *   (and the item is actually an image). Results are already threshold-filtered
 *   and ordered most-to-least similar by the API.
 */
export function useSimilarImages(itemId: string, enabled = true) {
  return useQuery<SimilarImagesResponse>({
    queryKey: similarImagesQueryKey(itemId),
    queryFn: () => api.get(`/api/v1/items/${itemId}/similar`),
    enabled,
  });
}
