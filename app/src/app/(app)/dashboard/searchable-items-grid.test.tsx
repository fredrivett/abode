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

type CapturedProps = {
  items: Item[];
  showComposer?: boolean;
  composerDisabled?: boolean;
};

let captured: CapturedProps = { items: [] };
vi.mock("./items-grid", () => ({
  ItemsGrid: (props: CapturedProps) => {
    captured = props;
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

function rerenderGrid(rerender: (ui: React.ReactElement) => void) {
  rerender(
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
    captured = { items: [] };
    mockUseSearchResults.mockReset();
  });

  it("shows the full list and an enabled composer when there is no active search", () => {
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({ hasActiveSearch: false }),
    );
    renderGrid();
    expect(captured.items.map((i) => i.id)).toEqual(["full-1", "full-2"]);
    expect(captured.showComposer).toBe(true);
    expect(captured.composerDisabled).toBe(false);
  });

  it("shows resolved search results and hides the composer when a search completes", () => {
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({
        hasActiveSearch: true,
        hasReceivedResults: true,
        items: [item("match-a")],
        total: 1,
      }),
    );
    renderGrid();
    expect(captured.items.map((i) => i.id)).toEqual(["match-a"]);
    expect(captured.showComposer).toBe(false);
  });

  it("keeps the full list with a disabled composer while the first search is in flight", () => {
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({
        hasActiveSearch: true,
        isSearching: true,
        items: [],
      }),
    );
    renderGrid();
    // Still the full list (not flipped or emptied) so the grid doesn't reflow...
    expect(captured.items.map((i) => i.id)).toEqual(["full-1", "full-2"]);
    // ...but the composer is present and disabled, not removed
    expect(captured.showComposer).toBe(true);
    expect(captured.composerDisabled).toBe(true);
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
    expect(captured.items.map((i) => i.id)).toEqual(["match-a"]);

    // Next keystroke: a new query is in flight (previous items still held)
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({
        hasActiveSearch: true,
        isSearching: true,
        items: [item("match-a")],
        total: 1,
      }),
    );
    rerenderGrid(rerender);

    // Still the previous match, composer stays hidden (we're showing results)
    expect(captured.items.map((i) => i.id)).toEqual(["match-a"]);
    expect(captured.showComposer).toBe(false);
  });
});
