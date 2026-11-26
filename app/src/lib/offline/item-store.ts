import type { Item } from "@/lib/types/item";

/**
 * The offline library: an on-device copy of the signed-in user's items, so the
 * app can show them with no connection. It holds one user's data at a time —
 * `meta.owner` says whose — and is deleted whenever the signed-in user changes
 * (see `session-caches`). Reads re-check the owner in the same transaction, so
 * a tab that opened it for one user never reads rows another tab wrote for the
 * next.
 */
const DB_NAME = "abode-offline";
const DB_VERSION = 1;

const CARDS = "cards";
const META = "meta";
const TIMELINE_INDEX = "timeline";
const OWNER_KEY = "owner";

/** Position on the timeline, newest first: `addedAt` then `id`, both descending */
export type TimelineCursor = Pick<Item, "addedAt" | "id">;

export type OfflineItemStore = {
  /** Adds or replaces items; dropped once the store belongs to someone else */
  putItems: (items: Item[]) => Promise<void>;
  removeItems: (ids: string[]) => Promise<void>;
  /**
   * Up to `limit` items in timeline order (as `ITEM_TIMELINE_ORDER_BY`),
   * starting after `after`. Empty once the store belongs to someone else.
   */
  readItems: (options: {
    limit: number;
    after?: TimelineCursor;
  }) => Promise<Item[]>;
  close: () => void;
};

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    const cards = db.createObjectStore(CARDS, { keyPath: "id" });
    // ISO timestamps from toISOString() all have the same length, so they sort
    // as strings in time order
    cards.createIndex(TIMELINE_INDEX, ["addedAt", "id"]);
    db.createObjectStore(META);
  };
  return done(request);
}

/**
 * Opens the offline library for `userId`, emptying it first if it holds
 * another user's items. Null where IndexedDB isn't available (some private
 * modes) — the app then works as it does without an offline copy.
 */
export async function openOfflineItemStore(
  userId: string,
): Promise<OfflineItemStore | null> {
  if (typeof indexedDB === "undefined") return null;
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch {
    return null;
  }

  const claim = db.transaction([CARDS, META], "readwrite");
  const meta = claim.objectStore(META);
  if ((await done(meta.get(OWNER_KEY))) !== userId) {
    claim.objectStore(CARDS).clear();
    meta.put(userId, OWNER_KEY);
  }
  await committed(claim);

  let closed = false;
  // Another tab is deleting it (the signed-in user changed): let go so the
  // delete isn't blocked. This handle then reads nothing and writes nothing
  db.onversionchange = () => {
    closed = true;
    db.close();
  };

  // A transaction that still belongs to `userId`, checked inside it so another
  // tab claiming the store for someone else can't slip in between. Null once
  // it doesn't: reads come back empty and writes are dropped
  async function ownedTransaction(
    mode: IDBTransactionMode,
  ): Promise<IDBTransaction | null> {
    if (closed) return null;
    const tx = db.transaction([CARDS, META], mode);
    const owner = await done(tx.objectStore(META).get(OWNER_KEY));
    return owner === userId ? tx : null;
  }

  return {
    async putItems(items) {
      const tx = await ownedTransaction("readwrite");
      if (!tx) return;
      const cards = tx.objectStore(CARDS);
      for (const item of items) cards.put(item);
      await committed(tx);
    },

    async removeItems(ids) {
      const tx = await ownedTransaction("readwrite");
      if (!tx) return;
      const cards = tx.objectStore(CARDS);
      for (const id of ids) cards.delete(id);
      await committed(tx);
    },

    async readItems({ limit, after }) {
      const tx = await ownedTransaction("readonly");
      if (!tx) return [];
      const range = after
        ? IDBKeyRange.upperBound([after.addedAt, after.id], true)
        : undefined;
      const cursorRequest = tx
        .objectStore(CARDS)
        .index(TIMELINE_INDEX)
        .openCursor(range, "prev");
      const items: Item[] = [];
      return new Promise((resolve, reject) => {
        cursorRequest.onerror = () => reject(cursorRequest.error);
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor || items.length >= limit) return resolve(items);
          items.push(cursor.value);
          cursor.continue();
        };
      });
    },

    close: () => {
      closed = true;
      db.close();
    },
  };
}

/**
 * Deletes the offline library. False when it couldn't be deleted yet: a tab
 * that predates the `versionchange` handler still has it open (the delete then
 * finishes once that tab closes), or IndexedDB refused.
 */
export function deleteOfflineItemStore(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return Promise.resolve(true);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
