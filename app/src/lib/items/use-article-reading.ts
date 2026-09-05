"use client";

import posthog from "posthog-js";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { api } from "@/lib/api-client";
import { useInvalidateItems } from "@/lib/api-hooks";

/**
 * Client mutations for an article's per-user read state.
 *
 * - `setRead` toggles read/unread with an immediate PATCH + items-query
 *   invalidation (so the sidebar toggle and the end-of-article nudge reconcile),
 *   and emits the read/unread analytics event.
 * - `saveScrollProgress` persists the reader's scroll position, debounced and
 *   coalesced so a scroll gesture writes once (the latest value) rather than on
 *   every frame. It deliberately does NOT invalidate the items query — scroll
 *   position isn't shown in the grid, so refetching the list on every scroll
 *   settle would be wasteful. Best-effort: a failed position write is silent.
 */
export function useArticleReading(itemId: string) {
  const invalidateItems = useInvalidateItems();

  const setRead = useCallback(
    (read: boolean) => {
      void (async () => {
        try {
          await api.patch(`/api/v1/items/${itemId}`, {
            articleReading: { read },
          });
          invalidateItems();
          posthog.capture(
            read ? "article_marked_read" : "article_marked_unread",
            { item_id: itemId },
          );
        } catch {
          toast.error(
            read ? "Failed to mark as read" : "Failed to mark as unread",
          );
        }
      })();
    },
    [itemId, invalidateItems],
  );

  // Guards against out-of-order writes: bumped on every scroll save so a slow
  // in-flight request can tell it's been superseded (it just no-ops on failure).
  const progressVersion = useRef(0);
  const commitProgress = useDebouncedCallback((scrollProgress: number) => {
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

  const saveScrollProgress = useCallback(
    (scrollProgress: number) => {
      progressVersion.current += 1;
      commitProgress(scrollProgress);
    },
    [commitProgress],
  );

  return { setRead, saveScrollProgress };
}
