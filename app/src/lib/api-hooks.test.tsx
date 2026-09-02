import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ITEMS_QUERY_KEY, useUpdateCachedItemTitle } from "./api-hooks";
import type { Item } from "./types/item";

const item = (id: string, title: string): Item =>
  ({ id, title }) as unknown as Item;

describe("useUpdateCachedItemTitle", () => {
  it("patches only the matching item's title across cached pages", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(ITEMS_QUERY_KEY, {
      pages: [
        {
          items: [item("a", "old-a"), item("b", "old-b")],
          cursor: null,
          hasMore: false,
        },
        { items: [item("c", "old-c")], cursor: null, hasMore: false },
      ],
      pageParams: [null, "cur"],
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateCachedItemTitle(), {
      wrapper,
    });

    act(() => result.current({ itemId: "b", title: "new-b" }));

    const data =
      queryClient.getQueryData<InfiniteData<{ items: Item[] }>>(
        ITEMS_QUERY_KEY,
      );
    const titles = data?.pages.flatMap((p) => p.items.map((i) => i.title));
    expect(titles).toEqual(["old-a", "new-b", "old-c"]);
  });

  it("is a no-op when the items cache is empty", () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateCachedItemTitle(), {
      wrapper,
    });

    act(() => result.current({ itemId: "a", title: "x" }));

    expect(queryClient.getQueryData(ITEMS_QUERY_KEY)).toBeUndefined();
  });
});
