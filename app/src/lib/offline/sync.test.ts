import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import type { Item } from "@/lib/types/item";
import { type OfflineItemStore, openOfflineItemStore } from "./item-store";
import { type GetJson, syncOfflineLibrary } from "./sync";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ApiClientError: (await importOriginal<typeof import("@/lib/api-client")>())
    .ApiClientError,
}));

const item = (id: string, updatedAt = "2026-01-01T00:00:00.000Z") =>
  ({ id, addedAt: "2026-01-01T00:00:00.000Z", updatedAt, title: id }) as Item;

type Page = { items: Item[]; cursor: string; hasMore: boolean; total: number };

/** A server answering changes pages in order, and the ids route from `live` */
function server(pages: Page[], live: string[] = []) {
  const urls: string[] = [];
  const get = vi.fn(async (url: string) => {
    urls.push(url);
    if (url.startsWith("/api/v1/items/ids")) return { ids: live };
    const page = pages.shift();
    if (!page) throw new Error(`unexpected ${url}`);
    return page;
  });
  return { get: get as unknown as GetJson, urls };
}

let store: OfflineItemStore;

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  const opened = await openOfflineItemStore("user-a");
  if (!opened) throw new Error("IndexedDB unavailable");
  store = opened;
});

const storedIds = async () =>
  (await store.readItems({ limit: 100 })).map((i) => i.id).sort();

describe("syncOfflineLibrary", () => {
  it("pages through a first sync, saving the cursor, and reports it as the first", async () => {
    const { get, urls } = server([
      { items: [item("a")], cursor: "c1", hasMore: true, total: 2 },
      { items: [item("b")], cursor: "c2", hasMore: false, total: 2 },
    ]);
    const result = await syncOfflineLibrary({ store, get });

    expect(result).toEqual({ status: "synced", firstSync: true, itemCount: 2 });
    expect(await storedIds()).toEqual(["a", "b"]);
    expect(urls[0]).not.toContain("cursor=");
    expect(urls[1]).toContain("cursor=c1");
    // Counts matched: no ids request
    expect(urls).toHaveLength(2);
    expect((await store.getSyncState())?.cursor).toBe("c2");
  });

  it("resumes from the saved cursor and drops items deleted elsewhere", async () => {
    await store.putItems([item("a"), item("b"), item("c")]);
    await store.setSyncState({
      cursor: "saved",
      lastSyncedAt: "2026-01-01T00:00:00.000Z",
    });
    const { get, urls } = server(
      [
        {
          items: [item("a", "2026-02-01T00:00:00.000Z")],
          cursor: "next",
          hasMore: false,
          total: 2,
        },
      ],
      ["a", "c"],
    );
    const result = await syncOfflineLibrary({ store, get });

    expect(urls[0]).toContain("cursor=saved");
    expect(result).toEqual({
      status: "synced",
      firstSync: false,
      itemCount: 2,
    });
    expect(await storedIds()).toEqual(["a", "c"]);
  });

  it("keeps a stored copy saved after the one a sync returns", async () => {
    await store.putItems([
      { ...item("a", "2026-03-01T00:00:00.000Z"), title: "newer" },
    ]);
    const { get } = server([
      {
        items: [{ ...item("a", "2026-02-01T00:00:00.000Z"), title: "older" }],
        cursor: "c",
        hasMore: false,
        total: 1,
      },
    ]);
    await syncOfflineLibrary({ store, get });
    expect((await store.readItems({ limit: 1 }))[0].title).toBe("newer");
  });

  it("deletes the library when the session has ended", async () => {
    await store.putItems([item("a-private")]);
    const get = (async () => {
      throw new ApiClientError({ message: "Unauthorized", status: 401 });
    }) as GetJson;
    expect(await syncOfflineLibrary({ store, get })).toEqual({
      status: "signed-out",
    });
    expect(await indexedDB.databases()).toEqual([]);
  });

  it("keeps the pages it got when a later one fails, so the next round resumes", async () => {
    const pages: Page[] = [
      { items: [item("a")], cursor: "c1", hasMore: true, total: 2 },
    ];
    const get = (async () => {
      const page = pages.shift();
      if (!page) throw new TypeError("Failed to fetch");
      return page;
    }) as GetJson;
    const result = await syncOfflineLibrary({ store, get });

    expect(result.status).toBe("failed");
    expect(await storedIds()).toEqual(["a"]);
    expect(await store.getSyncState()).toEqual({
      cursor: "c1",
      lastSyncedAt: null,
    });
  });
});
