import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ITEMS_QUERY_KEY, useUpdateCachedItemTitle } from "./api-hooks";
import { itemQueryKey } from "./items/use-item";
import type { Item } from "./types/item";

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
