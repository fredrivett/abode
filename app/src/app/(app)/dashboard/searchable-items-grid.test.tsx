import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@/lib/types/item";

const mockUseSearchResults = vi.fn();

vi.mock("@/lib/search", () => ({
  useSearch: () => ({ state: { query: "", filters: [] }, clearAll: vi.fn() }),
  useSearchResults: () => mockUseSearchResults(),
}));

vi.mock("@/lib/api-hooks", () => ({
  useItemsInfinite: () => ({
    data: undefined,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    error: null,
  }),
}));

vi.mock("@/lib/use-processing-poll", () => ({
  useProcessingPoll: vi.fn(),
}));

let capturedItems: Item[] = [];
vi.mock("./items-grid", () => ({
  ItemsGrid: (props: { items: Item[] }) => {
    capturedItems = props.items;
    return null;
  },
}));

import { SearchableItemsGrid } from "./searchable-items-grid";

const item = (id: string): Item => ({ id }) as unknown as Item;

type SearchResults = ReturnType<typeof mockUseSearchResults>;

function makeSearchResults(overrides: Partial<SearchResults>): SearchResults {
  return {
    isLoading: false,
    isSearching: false,
    hasReceivedResults: false,
    items: [],
    total: 0,
    cursor: null,
    hasMore: false,
    error: null,
    warnings: undefined,
    loadMore: vi.fn(),
    hasActiveSearch: false,
    ...overrides,
  };
}

const FULL_LIST = [item("full-1"), item("full-2")];

function renderGrid() {
  return render(
    <SearchableItemsGrid
      initialItems={FULL_LIST}
      initialCursor={null}
      initialHasMore={false}
      initialTotal={FULL_LIST.length}
      initialNoteDraft={null}
    />,
  );
}

describe("SearchableItemsGrid", () => {
  beforeEach(() => {
    capturedItems = [];
    mockUseSearchResults.mockReset();
  });

  it("shows the full paginated list when there is no active search", () => {
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({ hasActiveSearch: false }),
    );
    renderGrid();
    expect(capturedItems.map((i) => i.id)).toEqual(["full-1", "full-2"]);
  });

  it("shows resolved search results when a search completes", () => {
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({
        hasActiveSearch: true,
        hasReceivedResults: true,
        items: [item("match-a")],
        total: 1,
      }),
    );
    renderGrid();
    expect(capturedItems.map((i) => i.id)).toEqual(["match-a"]);
  });

  it("falls back to the full list while the first search is in flight", () => {
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({
        hasActiveSearch: true,
        isSearching: true,
        items: [],
      }),
    );
    renderGrid();
    expect(capturedItems.map((i) => i.id)).toEqual(["full-1", "full-2"]);
  });

  it("keeps the previous results in flight instead of flipping to the full list", () => {
    // First: a completed search
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({
        hasActiveSearch: true,
        hasReceivedResults: true,
        items: [item("match-a")],
        total: 1,
      }),
    );
    const { rerender } = renderGrid();
    expect(capturedItems.map((i) => i.id)).toEqual(["match-a"]);

    // Next keystroke: a new query is in flight (previous items still held)
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({
        hasActiveSearch: true,
        isSearching: true,
        items: [item("match-a")],
        total: 1,
      }),
    );
    rerender(
      <SearchableItemsGrid
        initialItems={FULL_LIST}
        initialCursor={null}
        initialHasMore={false}
        initialTotal={FULL_LIST.length}
        initialNoteDraft={null}
      />,
    );

    // Should still show the previous match, NOT the full unfiltered list
    expect(capturedItems.map((i) => i.id)).toEqual(["match-a"]);
  });
});
