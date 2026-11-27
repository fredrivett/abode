"use client";

import posthog from "posthog-js";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "@/lib/api-client";
import { useOnReplacedCachedItem } from "@/lib/api-hooks";
import {
  type OfflineItemStore,
  openOfflineItemStore,
} from "@/lib/offline/item-store";
import { toOfflineCard } from "@/lib/offline/offline-card";
import {
  type OfflineLibrary,
  OfflineLibraryContext,
} from "@/lib/offline/offline-library-context";
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
 * is open — a sync round once the page is idle and again whenever the
 * connection comes back, plus every item this tab writes into its caches —
 * and provides it to the app (`useOfflineLibrary`) for reading offline.
 */
export function OfflineLibraryProvider({ children }: { children: ReactNode }) {
  const userId = useUserStore((state) => state.userId);
  const storeRef = useRef<OfflineItemStore | null>(null);
  const [library, setLibrary] = useState<OfflineLibrary | null>(null);

  useEffect(() => {
    if (userId === undefined) return;
    let cancelled = false;

    // Provided once a round has finished, here or in an earlier session, so
    // an offline launch reads what the last online visit synced
    const publish = async (store: OfflineItemStore) => {
      const lastSyncedAt = (await store.getSyncState())?.lastSyncedAt ?? null;
      if (!cancelled && storeRef.current === store) {
        setLibrary(lastSyncedAt ? { store, lastSyncedAt } : null);
      }
    };

    const sync = () =>
      void withSyncLock(async () => {
        const store = storeRef.current;
        if (!store || !navigator.onLine) return;
        const startedAt = performance.now();
        const result = await syncOfflineLibrary({ store, get: api.get });
        if (result.status === "signed-out") {
          // The library was deleted with the session
          storeRef.current = null;
          if (!cancelled) setLibrary(null);
          return;
        }
        if (result.status === "failed") {
          posthog.captureException(result.error, { source: "offline_sync" });
        } else if (result.firstSync) {
          posthog.capture("offline_library_synced", {
            item_count: result.itemCount,
            duration_ms: Math.round(performance.now() - startedAt),
          });
        }
        await publish(store);
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
      if (!store) return;
      await publish(store);
      whenIdle(sync);
    })();

    window.addEventListener("online", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("online", sync);
      storeRef.current?.close();
      storeRef.current = null;
      setLibrary(null);
    };
  }, [userId]);

  useOnReplacedCachedItem(
    useCallback((item: Item) => {
      void storeRef.current?.putItems([toOfflineCard(item)]);
    }, []),
  );

  return (
    <OfflineLibraryContext.Provider value={library}>
      {children}
    </OfflineLibraryContext.Provider>
  );
}
