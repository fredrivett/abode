import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@/lib/types/item";

const mockUseSearchResults = vi.fn();

// Controllable next/navigation mock — a stable instance per value.
const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.params,
}));

// The provider only needs to render its children in these prop-capture tests.
vi.mock("./item-dialog-context", () => ({
  ItemDialogProvider: ({ children }: { children: React.ReactNode }) => children,
}));

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
  isSearchPending?: boolean;
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

function renderGrid(initialOpenItem: Item | null = null) {
  return render(
    <SearchableItemsGrid
      initialItems={FULL_LIST}
      initialCursor={null}
      initialHasMore={false}
      initialTotal={FULL_LIST.length}
      initialNoteDraft={null}
      initialOpenItem={initialOpenItem}
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
      initialOpenItem={null}
    />,
  );
}

describe("SearchableItemsGrid", () => {
  beforeEach(() => {
    captured = { items: [] };
    nav.params = new URLSearchParams();
    document.title = "abode";
    mockUseSearchResults.mockReset();
  });

  it("shows the full list and an enabled composer when there is no active search", () => {
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({ hasActiveSearch: false }),
    );
    renderGrid();
    expect(captured.items.map((i) => i.id)).toEqual(["full-1", "full-2"]);
    expect(captured.showComposer).toBe(true);
    expect(captured.isSearchPending).toBe(false);
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
    // ...but the composer is present and the grid is marked pending (dimmed)
    expect(captured.showComposer).toBe(true);
    expect(captured.isSearchPending).toBe(true);
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

    // Still the previous match, composer stays hidden (we're showing results),
    // and the grid is dimmed while the new query loads
    expect(captured.items.map((i) => i.id)).toEqual(["match-a"]);
    expect(captured.showComposer).toBe(false);
    expect(captured.isSearchPending).toBe(true);
  });

  it("injects the open item at the front when it isn't already in the list", () => {
    nav.params = new URLSearchParams("item=deep-linked");
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({ hasActiveSearch: false }),
    );
    renderGrid(item("deep-linked"));
    expect(captured.items.map((i) => i.id)).toEqual([
      "deep-linked",
      "full-1",
      "full-2",
    ]);
  });

  it("doesn't duplicate the open item when it's already in the list", () => {
    nav.params = new URLSearchParams("item=full-1");
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({ hasActiveSearch: false }),
    );
    renderGrid(item("full-1"));
    expect(captured.items.map((i) => i.id)).toEqual(["full-1", "full-2"]);
  });

  it("doesn't inject the open item once the URL no longer addresses it", () => {
    // Dialog closed: item param gone, so the injected card shouldn't linger
    nav.params = new URLSearchParams();
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({ hasActiveSearch: false }),
    );
    renderGrid(item("deep-linked"));
    expect(captured.items.map((i) => i.id)).toEqual(["full-1", "full-2"]);
  });

  it("sets the tab title to the open item (whether from the list or a deep link)", () => {
    nav.params = new URLSearchParams("item=deep");
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({ hasActiveSearch: false }),
    );
    renderGrid({ id: "deep", title: "My Item" } as unknown as Item);
    expect(document.title).toBe("My Item | abode");
  });

  it("leaves the tab title alone when no item is open", () => {
    nav.params = new URLSearchParams();
    mockUseSearchResults.mockReturnValue(
      makeSearchResults({ hasActiveSearch: false }),
    );
    renderGrid();
    expect(document.title).toBe("abode");
  });
});
