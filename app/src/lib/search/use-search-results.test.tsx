import { act, renderHook, waitFor } from "@testing-library/react";
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

function results(items: Array<{ id: string; title: string }>): SearchResponse {
  return {
    items,
    total: items.length,
    cursor: null,
    warnings: undefined,
  } as unknown as SearchResponse;
}

beforeEach(() => vi.mocked(search).mockReset());

describe("useSearchResults patchItemTitle", () => {
  it("updates a single result's title in place", async () => {
    vi.mocked(search).mockResolvedValue(
      results([
        { id: "a", title: "Old A" },
        { id: "b", title: "B" },
      ]),
    );

    const { result } = renderHook(() => useSearchResults(searchState));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    act(() => result.current.patchItemTitle("a", "New A"));

    expect(result.current.items.map((i) => i.title)).toEqual(["New A", "B"]);
  });

  it("leaves other results untouched and no-ops for an unknown id", async () => {
    vi.mocked(search).mockResolvedValue(results([{ id: "a", title: "A" }]));

    const { result } = renderHook(() => useSearchResults(searchState));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    act(() => result.current.patchItemTitle("missing", "x"));

    expect(result.current.items.map((i) => i.title)).toEqual(["A"]);
  });
});
