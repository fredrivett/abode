import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SearchResponse, search } from "./api";
import type { SearchState } from "./types";
import { useSearchResults } from "./use-search-results";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("./api", () => ({
  search: vi.fn(),
  SearchError: class SearchError extends Error {},
}));

const searchState = {
  query: "cat",
  filters: [],
} as unknown as SearchState;

function results(
  items: Array<{ id: string; title: string }>,
  extra: Partial<SearchResponse> = {},
): SearchResponse {
  return {
    items,
    total: items.length,
    cursor: null,
    warnings: undefined,
    ...extra,
  } as unknown as SearchResponse;
}

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(search).mockReset();
  vi.mocked(toast.error).mockReset();
  queryClient = new QueryClient();
});

describe("useSearchResults", () => {
  it("doesn't search without criteria", () => {
    const { result } = renderHook(
      () =>
        useSearchResults({ query: "", filters: [] } as unknown as SearchState),
      { wrapper },
    );

    expect(result.current.hasActiveSearch).toBe(false);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it("refetches when the items namespace is invalidated after an edit", async () => {
    vi.mocked(search).mockResolvedValueOnce(
      results([
        { id: "a", title: "Reading A" },
        { id: "b", title: "B" },
      ]),
    );

    const { result } = renderHook(() => useSearchResults(searchState), {
      wrapper,
    });
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    // The edited item no longer matches the search (e.g. marked read under a
    // reading filter), so the refetch drops it. Held pending so we can check
    // the in-flight state.
    let resolveRefetch: (response: SearchResponse) => void = () => {};
    vi.mocked(search).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefetch = resolve;
      }),
    );
    act(() => {
      void queryClient.invalidateQueries({ queryKey: ["items"] });
    });
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));

    // A background refetch isn't a new search, so the grid doesn't dim and
    // keeps showing the current results while it's in flight
    expect(result.current.isSearching).toBe(false);
    expect(result.current.items).toHaveLength(2);

    act(() => resolveRefetch(results([{ id: "b", title: "B" }])));
    await waitFor(() =>
      expect(result.current.items.map((i) => i.id)).toEqual(["b"]),
    );
    expect(result.current.isSearching).toBe(false);
  });

  it("paginates with the cursor and appends results", async () => {
    vi.mocked(search)
      .mockResolvedValueOnce(
        results([{ id: "a", title: "A" }], { total: 2, cursor: "next" }),
      )
      .mockResolvedValueOnce(results([{ id: "b", title: "B" }]));

    const { result } = renderHook(() => useSearchResults(searchState), {
      wrapper,
    });
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    await act(() => result.current.loadMore());

    await waitFor(() =>
      expect(result.current.items.map((i) => i.id)).toEqual(["a", "b"]),
    );
    expect(vi.mocked(search).mock.calls[1][0]).toEqual({
      q: "cat",
      cursor: "next",
    });
    expect(result.current.total).toBe(2);
    expect(result.current.hasMore).toBe(false);
  });

  it("toasts invalid filters once, not again on an edit's refetch", async () => {
    vi.mocked(search).mockResolvedValue(
      results([], {
        invalidFilters: [{ filterType: "tag", value: "nope", reason: "x" }],
      }),
    );

    const { result } = renderHook(() => useSearchResults(searchState), {
      wrapper,
    });
    await waitFor(() => expect(result.current.hasReceivedResults).toBe(true));
    expect(toast.error).toHaveBeenCalledTimes(1);

    await act(() => queryClient.invalidateQueries({ queryKey: ["items"] }));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));

    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

describe("useSearchResults patchItemTitle", () => {
  it("updates a single result's title in place", async () => {
    vi.mocked(search).mockResolvedValue(
      results([
        { id: "a", title: "Old A" },
        { id: "b", title: "B" },
      ]),
    );

    const { result } = renderHook(() => useSearchResults(searchState), {
      wrapper,
    });
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    act(() => result.current.patchItemTitle("a", "New A"));

    await waitFor(() =>
      expect(result.current.items.map((i) => i.title)).toEqual(["New A", "B"]),
    );
  });

  it("leaves other results untouched and no-ops for an unknown id", async () => {
    vi.mocked(search).mockResolvedValue(results([{ id: "a", title: "A" }]));

    const { result } = renderHook(() => useSearchResults(searchState), {
      wrapper,
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    act(() => result.current.patchItemTitle("missing", "x"));

    expect(result.current.items.map((i) => i.title)).toEqual(["A"]);
  });
});
