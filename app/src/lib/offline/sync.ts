import { ApiClientError } from "@/lib/api-client";
import { MAX_PAGE_SIZE } from "@/lib/pagination";
import type { Item } from "@/lib/types/item";
import { deleteOfflineItemStore, type OfflineItemStore } from "./item-store";

type ChangesPage = {
  items: Item[];
  cursor: string;
  hasMore: boolean;
  total: number;
};

/** `api.get`, injectable for tests */
export type GetJson = <T>(url: string) => Promise<T>;

export type SyncResult =
  | { status: "synced"; firstSync: boolean; itemCount: number }
  /** The session ended (401): the store was deleted */
  | { status: "signed-out" }
  /** Offline or a server error: progress so far is kept, the next round resumes */
  | { status: "failed"; error: unknown };

/**
 * One sync round: pages through every item changed since the saved cursor
 * (the whole library on a first sync), saving the cursor after each page so
 * an interrupted round resumes where it stopped. Then, if the store holds a
 * different number of items than the server, drops the ones deleted
 * elsewhere. Never throws.
 */
export async function syncOfflineLibrary({
  store,
  get,
}: {
  store: OfflineItemStore;
  get: GetJson;
}): Promise<SyncResult> {
  try {
    const saved = await store.getSyncState();
    const lastSyncedAt = saved?.lastSyncedAt ?? null;
    let cursor = saved?.cursor;
    let page: ChangesPage;
    do {
      const params = new URLSearchParams({ limit: String(MAX_PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      page = await get<ChangesPage>(`/api/v1/items/changes?${params}`);
      await store.putItems(page.items);
      cursor = page.cursor;
      await store.setSyncState({ cursor, lastSyncedAt });
    } while (page.hasMore);

    // Every server item is stored by now, so a higher count means some were
    // deleted elsewhere
    let itemCount = await store.countItems();
    if (itemCount !== page.total) {
      const { ids } = await get<{ ids: string[] }>("/api/v1/items/ids");
      const live = new Set(ids);
      const gone = (await store.listIds()).filter((id) => !live.has(id));
      await store.removeItems(gone);
      itemCount -= gone.length;
    }

    await store.setSyncState({
      cursor,
      lastSyncedAt: new Date().toISOString(),
    });
    return { status: "synced", firstSync: lastSyncedAt === null, itemCount };
  } catch (error) {
    // Revoked or expired elsewhere: the library mustn't outlive the session
    if (error instanceof ApiClientError && error.status === 401) {
      await deleteOfflineItemStore();
      return { status: "signed-out" };
    }
    return { status: "failed", error };
  }
}

/**
 * Runs `task` unless another tab is already syncing, so two tabs don't page
 * through the library at once. Without Web Locks (older Safari) it just runs.
 */
export async function withSyncLock(task: () => Promise<void>): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.locks) return task();
  await navigator.locks.request(
    "abode-offline-sync",
    { ifAvailable: true },
    async (lock) => {
      if (lock) await task();
    },
  );
}
