import "fake-indexeddb/auto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api-client";
import { useItemsInfinite } from "@/lib/api-hooks";
import { useItem } from "@/lib/items/use-item";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { Item } from "@/lib/types/item";
import { type OfflineItemStore, openOfflineItemStore } from "./item-store";
import { OfflineLibraryContext } from "./offline-library-context";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  api: { get: vi.fn() },
}));

// Newest first: item-0 has the latest addedAt
const stored = Array.from({ length: DEFAULT_PAGE_SIZE + 5 }, (_, i) => {
  const addedAt = new Date(Date.UTC(2026, 10, 1) - i * 60_000).toISOString();
  return {
    id: `item-${i}`,
    addedAt,
    updatedAt: addedAt,
    title: `Item ${i}`,
  } as Item;
});

let store: OfflineItemStore;

function wrapper({ withLibrary = true } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const library = withLibrary
    ? { store, lastSyncedAt: "2026-11-26T00:00:00.000Z" }
    : null;
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <OfflineLibraryContext.Provider value={library}>
        {children}
      </OfflineLibraryContext.Provider>
    </QueryClientProvider>
  );
}

// Offline, any request the server query still makes fails as fetch does (React
// Query goes by online/offline events, so it may still try)
const setOnline = (online: boolean) => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  if (!online) {
    vi.mocked(api.get).mockRejectedValue(new TypeError("Failed to fetch"));
  }
};

// The server-rendered first page, as a days-old cached dashboard would have it
const staleSsrPage = {
  items: [{ id: "deleted-since", addedAt: "2026-12-01T00:00:00.000Z" } as Item],
  cursor: "server-cursor",
  hasMore: true,
  total: 99,
};

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  const opened = await openOfflineItemStore("user-a");
  if (!opened) throw new Error("IndexedDB unavailable");
  store = opened;
  await store.putItems(stored);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(api.get).mockReset();
});

const ids = (pages: { items: Item[] }[] | undefined) =>
  pages?.flatMap((page) => page.items.map((item) => item.id));

describe("useItemsInfinite offline", () => {
  it("reads every page from the offline library, never the server's first page", async () => {
    setOnline(false);
    const { result } = renderHook(() => useItemsInfinite(staleSsrPage), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    const first = result.current.data?.pages[0];
    expect(ids(result.current.data?.pages)).toEqual(
      stored.slice(0, DEFAULT_PAGE_SIZE).map((item) => item.id),
    );
    expect(first?.total).toBe(stored.length);
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(ids(result.current.data?.pages)).toEqual(
      stored.map((item) => item.id),
    );
    expect(result.current.hasNextPage).toBe(false);
    // The server list isn't tried offline, so it has no error to show later
    expect(api.get).not.toHaveBeenCalled();
  });

  it("keeps to the server's list online, even with a synced library", () => {
    setOnline(true);
    const { result } = renderHook(() => useItemsInfinite(staleSsrPage), {
      wrapper: wrapper(),
    });
    expect(ids(result.current.data?.pages)).toEqual(["deleted-since"]);
  });

  it("keeps to the server's list offline until the library has synced", () => {
    setOnline(false);
    const { result } = renderHook(() => useItemsInfinite(staleSsrPage), {
      wrapper: wrapper({ withLibrary: false }),
    });
    expect(ids(result.current.data?.pages)).toEqual(["deleted-since"]);
  });
});

describe("useItem offline", () => {
  it("opens an item from the offline library", async () => {
    setOnline(false);
    const last = stored.at(-1);
    const { result } = renderHook(() => useItem(last?.id ?? null), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.data?.title).toBe(last?.title));
    expect(api.get).not.toHaveBeenCalled();
  });

  it("fails, rather than waiting forever, for an item the library doesn't hold", async () => {
    setOnline(false);
    const { result } = renderHook(() => useItem("not-stored"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
