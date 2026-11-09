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
    return result;
  }

  async function reveal(run: () => Promise<void>) {
    vi.useFakeTimers();
    await act(async () => {
      const done = run();
      await vi.runAllTimersAsync();
      await done;
    });
  }

  it("refetches until a stale list includes the new item", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(page("old"))
      .mockResolvedValueOnce(page("old"))
      .mockResolvedValue(page("new", "old"));
    const result = setup();

    await reveal(() => result.current("new"));

    // Two stale lists, then the one with the new item
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(posthog.captureException).not.toHaveBeenCalled();
  });

  it("reports an item that never shows up", async () => {
    vi.mocked(api.get).mockResolvedValue(page("old"));
    const result = setup();

    await reveal(() => result.current("new"));

    // The first check plus one per retry
    expect(api.get).toHaveBeenCalledTimes(
      CREATED_ITEM_RETRY_DELAYS_MS.length + 1,
    );
    expect(posthog.captureException).toHaveBeenCalledTimes(1);
  });

  it("doesn't wait on a list nothing is showing", async () => {
    const result = setup({ showList: false });

    await reveal(() => result.current("new"));

    expect(api.get).not.toHaveBeenCalled();
    expect(posthog.captureException).not.toHaveBeenCalled();
  });
});
