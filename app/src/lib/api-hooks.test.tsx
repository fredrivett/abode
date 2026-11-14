import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import posthog from "posthog-js";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api-client";
import {
  CREATED_ITEM_RETRY_DELAYS_MS,
  ITEMS_QUERY_KEY,
  useItemsInfinite,
  useRefreshCachedItems,
  useRemoveCachedItem,
  useReplaceCachedItem,
  useRevealCreatedItem,
  useUpdateCachedItemTitle,
} from "./api-hooks";
import { itemQueryKey } from "./items/use-item";
import type { Item } from "./types/item";

vi.mock("posthog-js", () => ({ default: { captureException: vi.fn() } }));
vi.mock("./api-client", () => ({ api: { get: vi.fn() } }));

function makeItem(id: string, title: string): Item {
  return { id, title } as unknown as Item;
}

describe("useUpdateCachedItemTitle", () => {
  it("patches the title in both the list cache and the item-detail cache", () => {
    const client = new QueryClient();
    client.setQueryData<InfiniteData<{ items: Item[] }>>(ITEMS_QUERY_KEY, {
      pages: [{ items: [makeItem("a", "Old A"), makeItem("b", "B")] }],
      pageParams: [null],
    });
    client.setQueryData<Item>(itemQueryKey("a"), makeItem("a", "Old A"));

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useUpdateCachedItemTitle(), {
      wrapper,
    });

    act(() => result.current("a", "New A"));

    const list =
      client.getQueryData<InfiniteData<{ items: Item[] }>>(ITEMS_QUERY_KEY);
    expect(list?.pages[0].items.map((i) => i.title)).toEqual(["New A", "B"]);
    expect(client.getQueryData<Item>(itemQueryKey("a"))?.title).toBe("New A");
  });

  it("no-ops cleanly when the caches are empty", () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useUpdateCachedItemTitle(), {
      wrapper,
    });

    expect(() => act(() => result.current("missing", "x"))).not.toThrow();
    expect(client.getQueryData(itemQueryKey("missing"))).toBeUndefined();
  });
});

describe("useRevealCreatedItem", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const page = (...ids: string[]) => ({
    items: ids.map((id) => makeItem(id, id)),
    cursor: null,
    hasMore: false,
    total: ids.length,
  });

  // The dashboard's full list, mounted, plus the reveal callback
  function setup({ showList = true }: { showList?: boolean } = {}) {
    const client = new QueryClient({
      // Fresh initial data: no mount fetch, so every api.get is a reveal attempt
      defaultOptions: {
        queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const withList = () => {
      useItemsInfinite(page("old"));
      return useRevealCreatedItem();
    };
    const { result } = renderHook(showList ? withList : useRevealCreatedItem, {
      wrapper,
    });
    const listedIds = () =>
      client
        .getQueryData<InfiniteData<{ items: Item[]; total?: number }>>(
          ITEMS_QUERY_KEY,
        )
        ?.pages.flatMap((p) => p.items.map((i) => i.id));
    return { result, client, listedIds };
  }

  async function reveal(run: () => Promise<void>) {
    vi.useFakeTimers();
    await act(async () => {
      const done = run();
      await vi.runAllTimersAsync();
      await done;
    });
  }

  it("fetches just the new item and puts it first in the list", async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [makeItem("new", "new")] });
    const { result, client, listedIds } = setup();

    await reveal(() => result.current("new"));

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith("/api/v1/items?ids=new");
    expect(listedIds()).toEqual(["new", "old"]);
    expect(
      client.getQueryData<InfiniteData<{ total: number }>>(ITEMS_QUERY_KEY)
        ?.pages[0].total,
    ).toBe(2);
    expect(posthog.captureException).not.toHaveBeenCalled();
  });

  it("tries again when the fetch fails", async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ items: [makeItem("new", "new")] });
    const { result, listedIds } = setup();

    await reveal(() => result.current("new"));

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(listedIds()).toEqual(["new", "old"]);
    expect(posthog.captureException).not.toHaveBeenCalled();
  });

  it("reports an item that never shows up", async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [] });
    const { result } = setup();

    await reveal(() => result.current("new"));

    // One fetch per wait before the last check
    expect(api.get).toHaveBeenCalledTimes(CREATED_ITEM_RETRY_DELAYS_MS.length);
    expect(posthog.captureException).toHaveBeenCalledTimes(1);
  });

  it("doesn't fetch for a list nothing has loaded", async () => {
    const { result } = setup({ showList: false });

    await reveal(() => result.current("new"));

    expect(api.get).not.toHaveBeenCalled();
    expect(posthog.captureException).not.toHaveBeenCalled();
  });
});

describe("item cache helpers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  type Page = { items: Item[]; cursor: string | null; total?: number };
  const item = (
    id: string,
    title: string,
    updatedAt = "2026-01-01T00:00:00Z",
  ) => ({ id, title, updatedAt }) as unknown as Item;
  const searchKey = ["items", "search", { q: "x" }];

  // Two loaded list pages, a search holding "b", and per-item queries
  function setup() {
    const client = new QueryClient();
    client.setQueryData<InfiniteData<Page>>(ITEMS_QUERY_KEY, {
      pages: [
        { items: [item("a", "A")], cursor: "c1", total: 10 },
        { items: [item("b", "B"), item("c", "C")], cursor: null },
      ],
      pageParams: [null, "c1"],
    });
    client.setQueryData(searchKey, {
      pages: [
        {
          items: [{ ...item("b", "B"), match: { reasons: ["tag"] } }],
          total: 3,
        },
      ],
      pageParams: [null],
    });
    client.setQueryData(itemQueryKey("b"), item("b", "B"));
    client.setQueryData(["items", "a", "similar"], {
      items: [{ id: "b" }, { id: "c" }],
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const hooks = renderHook(
      () => ({
        remove: useRemoveCachedItem(),
        replace: useReplaceCachedItem(),
        refresh: useRefreshCachedItems(),
      }),
      { wrapper },
    ).result;
    const list = () => client.getQueryData<InfiniteData<Page>>(ITEMS_QUERY_KEY);
    const search = () =>
      client.getQueryData<InfiniteData<Page>>(searchKey)?.pages[0];
    return { client, hooks, list, search };
  }

  it("removes a deleted item from every cache and counts it out", () => {
    const { client, hooks, list, search } = setup();

    act(() => hooks.current.remove("b"));

    expect(list()?.pages.map((p) => p.items.map((i) => i.id))).toEqual([
      ["a"],
      ["c"],
    ]);
    // The total lives on the first page, even when the item was on another
    expect(list()?.pages[0].total).toBe(9);
    expect(search()).toMatchObject({ items: [], total: 2 });
    expect(client.getQueryData(itemQueryKey("b"))).toBeUndefined();
    expect(client.getQueryData(["items", "a", "similar"])).toEqual({
      items: [{ id: "c" }],
    });
  });

  it("writes an updated item everywhere, keeping search match reasons", () => {
    const { client, hooks, list, search } = setup();

    act(() => hooks.current.replace(item("b", "B2", "2026-01-02T00:00:00Z")));

    expect(list()?.pages[1].items[0].title).toBe("B2");
    expect(search()?.items[0]).toMatchObject({
      title: "B2",
      match: { reasons: ["tag"] },
    });
    expect(client.getQueryData<Item>(itemQueryKey("b"))?.title).toBe("B2");
    // Nothing else is touched
    expect(list()?.pages[0].total).toBe(10);
  });

  it("keeps a cached copy written after the one arriving", () => {
    const { hooks, list } = setup();

    act(() =>
      hooks.current.replace(item("b", "Newer", "2026-01-03T00:00:00Z")),
    );
    act(() =>
      hooks.current.replace(item("b", "Older", "2026-01-02T00:00:00Z")),
    );

    expect(list()?.pages[1].items[0].title).toBe("Newer");
  });

  it("refreshes just the given items, dropping ones that no longer exist", async () => {
    vi.mocked(api.get).mockResolvedValue({
      items: [item("a", "A2", "2026-01-02T00:00:00Z")],
    });
    const { hooks, list } = setup();

    let ok = false;
    await act(async () => {
      ok = await hooks.current.refresh(["a", "c"]);
    });

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith("/api/v1/items?ids=a%2Cc");
    expect(ok).toBe(true);
    expect(list()?.pages.map((p) => p.items.map((i) => i.title))).toEqual([
      ["A2"],
      ["B"],
    ]);
  });

  it("reports a refresh that failed, leaving the caches as they were", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("offline"));
    const { hooks, list } = setup();
    const before = list();

    let ok = true;
    await act(async () => {
      ok = await hooks.current.refresh(["a"]);
    });

    expect(ok).toBe(false);
    expect(list()).toBe(before);
  });
});
