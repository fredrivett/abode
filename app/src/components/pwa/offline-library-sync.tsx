"use client";

import posthog from "posthog-js";
import { useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api-client";
import { useOnReplacedCachedItem } from "@/lib/api-hooks";
import {
  type OfflineItemStore,
  openOfflineItemStore,
} from "@/lib/offline/item-store";
import { toOfflineCard } from "@/lib/offline/offline-card";
import { syncOfflineLibrary, withSyncLock } from "@/lib/offline/sync";
import { claimUserCaches } from "@/lib/pwa/session-caches";
import type { Item } from "@/lib/types/item";
import { useUserStore } from "@/stores/user-store";

function whenIdle(run: () => void) {
  if (typeof requestIdleCallback === "function") requestIdleCallback(run);
  else setTimeout(run, 1000);
}

/**
 * Keeps the offline library in step with the server while the signed-in app
 * is open: a sync round once the page is idle and again whenever the
 * connection comes back, plus every item this tab writes into its caches.
 */
export function OfflineLibrarySync() {
  const userId = useUserStore((state) => state.userId);
  const storeRef = useRef<OfflineItemStore | null>(null);

  useEffect(() => {
    if (userId === undefined) return;
    let cancelled = false;

    const sync = () =>
      void withSyncLock(async () => {
        const store = storeRef.current;
        if (!store || !navigator.onLine) return;
        const startedAt = performance.now();
        const result = await syncOfflineLibrary({ store, get: api.get });
        if (result.status === "failed") {
          posthog.captureException(result.error, { source: "offline_sync" });
        } else if (result.status === "synced" && result.firstSync) {
          posthog.capture("offline_library_synced", {
            item_count: result.itemCount,
            duration_ms: Math.round(performance.now() - startedAt),
          });
        }
      });

    void (async () => {
      // Opened only once a previous user's library is gone, or the delete
      // would close this tab's fresh handle under it
      await claimUserCaches(userId);
      const store = await openOfflineItemStore(userId);
      if (cancelled) {
        store?.close();
        return;
      }
      storeRef.current = store;
      whenIdle(sync);
    })();

    window.addEventListener("online", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("online", sync);
      storeRef.current?.close();
      storeRef.current = null;
    };
  }, [userId]);

  useOnReplacedCachedItem(
    useCallback((item: Item) => {
      void storeRef.current?.putItems([toOfflineCard(item)]);
    }, []),
  );

  return null;
}
