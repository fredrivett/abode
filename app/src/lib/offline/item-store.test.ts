import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@/lib/types/item";
import { deleteOfflineItemStore, openOfflineItemStore } from "./item-store";

const item = (id: string, addedAt: string) =>
  ({ id, addedAt, createdAt: addedAt, title: id }) as Item;

async function open(userId: string) {
  const store = await openOfflineItemStore(userId);
  if (!store) throw new Error("IndexedDB unavailable");
  return store;
}

const ids = (items: Item[]) => items.map((i) => i.id);

describe("offline item store", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
  });

  it("reads in timeline order: newest addedAt first, ties by id descending, paged after a cursor", async () => {
    const store = await open("user-a");
    await store.putItems([
      // A backdated import: created last, but oldest on the timeline
      {
        ...item("import", "2020-01-01T00:00:00.000Z"),
        createdAt: "2026-11-01T00:00:00.000Z",
      },
      item("b", "2026-06-01T00:00:00.000Z"),
      item("c", "2026-06-01T00:00:00.000Z"),
      item("a", "2026-10-01T00:00:00.000Z"),
    ]);

    const first = await store.readItems({ limit: 2 });
    expect(ids(first)).toEqual(["a", "c"]);
    const rest = await store.readItems({ limit: 10, after: first[1] });
    expect(ids(rest)).toEqual(["b", "import"]);
  });

  it("replaces an item put again and drops removed ones", async () => {
    const store = await open("user-a");
    await store.putItems([item("a", "2026-01-01T00:00:00.000Z")]);
    await store.putItems([
      { ...item("a", "2026-01-01T00:00:00.000Z"), title: "renamed" },
      item("b", "2026-02-01T00:00:00.000Z"),
    ]);
    await store.removeItems(["b"]);
    const items = await store.readItems({ limit: 10 });
    expect(items.map((i) => i.title)).toEqual(["renamed"]);
  });

  it("keeps the items when the same user opens it again", async () => {
    const first = await open("user-a");
    await first.putItems([item("a", "2026-01-01T00:00:00.000Z")]);
    first.close();
    const again = await open("user-a");
    expect(ids(await again.readItems({ limit: 10 }))).toEqual(["a"]);
  });

  it("empties another user's items when opened for a new user", async () => {
    const a = await open("user-a");
    await a.putItems([item("a-private", "2026-01-01T00:00:00.000Z")]);
    a.close();
    const b = await open("user-b");
    expect(await b.readItems({ limit: 10 })).toEqual([]);
  });

  it("stops reading in a tab opened for the previous user once another tab claims it", async () => {
    const tabA = await open("user-a");
    const tabB = await open("user-b");
    await tabB.putItems([item("b-private", "2026-01-01T00:00:00.000Z")]);
    expect(await tabA.readItems({ limit: 10 })).toEqual([]);
  });

  it("drops writes from a tab opened for the previous user once another tab claims it", async () => {
    const tabA = await open("user-a");
    const tabB = await open("user-b");
    await tabA.putItems([item("a-private", "2026-01-01T00:00:00.000Z")]);
    await tabA.removeItems(["b-1"]);
    await tabB.putItems([item("b-1", "2026-01-01T00:00:00.000Z")]);
    expect(ids(await tabB.readItems({ limit: 10 }))).toEqual(["b-1"]);
  });

  it("reads nothing and drops writes, without throwing, once deleted under it", async () => {
    const tab = await open("user-a");
    await tab.putItems([item("a", "2026-01-01T00:00:00.000Z")]);
    await deleteOfflineItemStore();
    await expect(tab.readItems({ limit: 10 })).resolves.toEqual([]);
    await expect(
      tab.putItems([item("b", "2026-01-01T00:00:00.000Z")]),
    ).resolves.toBeUndefined();
  });

  it("deletes even while another tab has it open", async () => {
    const otherTab = await open("user-a");
    await otherTab.putItems([item("a", "2026-01-01T00:00:00.000Z")]);
    await expect(deleteOfflineItemStore()).resolves.toBe(true);
    expect(await (await open("user-a")).readItems({ limit: 10 })).toEqual([]);
  });

  it("is unavailable, not an error, without IndexedDB", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(openOfflineItemStore("user-a")).resolves.toBeNull();
    await expect(deleteOfflineItemStore()).resolves.toBe(true);
  });
});
