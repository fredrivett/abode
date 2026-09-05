"use client";

import posthog from "posthog-js";
import { useCallback } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";

/**
 * Client mutations for an article's per-user read state.
 *
 * - `setRead` toggles read/unread with an immediate PATCH + items-query
 *   invalidation (so the sidebar toggle and the end-of-article nudge reconcile),
 *   and emits the read/unread analytics event. Resolves `true` on success and
 *   `false` on failure so callers can revert optimistic UI.
 * - `saveScrollProgress` persists the reader's scroll position, debounced and
 *   coalesced so a scroll gesture writes once (the trailing value) per ~500ms
 *   pause rather than on every frame. Last-write-wins and fire-and-forget: it
 *   doesn't invalidate the items query (scroll position isn't shown in the grid)
 *   and doesn't guard write ordering across debounce windows — it's a resume
 *   hint, so a lost or out-of-order write is harmless and never surfaced.
 */
export function useArticleReading(itemId: string) {
  const invalidateItems = useInvalidateItems();

  const setRead = useCallback(
    async (read: boolean): Promise<boolean> => {
      try {
        await api.patch(`/api/v1/items/${itemId}`, {
          articleReading: { read },
        });
        invalidateItems();
        posthog.capture(
          read ? "article_marked_read" : "article_marked_unread",
          { item_id: itemId },
        );
        return true;
      } catch {
        toast.error(
          read ? "Failed to mark as read" : "Failed to mark as unread",
        );
        return false;
      }
    },
    [itemId, invalidateItems],
  );

  const saveScrollProgress = useDebouncedCallback((scrollProgress: number) => {
    void api
      .patch(`/api/v1/items/${itemId}`, { articleReading: { scrollProgress } })
      .then(() => {
        posthog.capture("article_read_progress_updated", {
          item_id: itemId,
          scroll_progress: scrollProgress,
        });
      })
      .catch(() => {
        // Best-effort resume position — never surface an error for this.
      });
  }, 500);

  return { setRead, saveScrollProgress };
}
