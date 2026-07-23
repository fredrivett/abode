"use client";

import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useItemsInfinite } from "@/lib/api-hooks";
import { useSearch, useSearchResults } from "@/lib/search";
import type { Item } from "@/lib/types/item";
import { useProcessingPoll } from "@/lib/use-processing-poll";
import { ItemsGrid } from "./items-grid";

type SearchableItemsGridProps = {
  initialItems: Item[];
  initialCursor: string | null;
  initialHasMore: boolean;
  initialTotal: number;
  /** Server-rendered composer draft, avoiding a client fetch on load */
  initialNoteDraft: string | null;
};

/**
 * Items grid with integrated search, infinite scroll, and processing status polling.
 *
 * Switches between paginated items and search results depending on whether a
 * search query or filters are active.
 */
export function SearchableItemsGrid({
  initialItems,
  initialCursor,
  initialHasMore,
  initialTotal,
  initialNoteDraft,
}: SearchableItemsGridProps) {
  const { state: searchState, clearAll } = useSearch();
  const searchResults = useSearchResults(searchState);

  // Use React Query for items with SSR hydration
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, error } =
    useItemsInfinite({
      items: initialItems,
      cursor: initialCursor,
      hasMore: initialHasMore,
      total: initialTotal,
    });

  // Show error toast if fetch fails
  useEffect(() => {
    if (error) {
      toast.error("Failed to load more items. Please try again.");
    }
  }, [error]);

  // Flatten all pages into a single items array
  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? initialItems,
    [data?.pages, initialItems],
  );

  // Get total from first page (only returned on initial fetch)
  const total = data?.pages[0]?.total ?? initialTotal;

  // Get IDs of items that are still processing
  const processingItemIds = useMemo(
    () =>
      items
        .filter((item) => item.processingStatus === "processing")
        .map((item) => item.id),
    [items],
  );

  // Poll for status updates on processing items
  useProcessingPoll(processingItemIds);

  // Load more handler
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const searchItems = useMemo((): Item[] | null => {
    // No active search - use initial items
    if (!searchResults.hasActiveSearch) {
      return null;
    }

    // Still searching - keep showing previous items
    if (searchResults.isSearching || searchResults.isLoading) {
      return null;
    }

    // Search complete - items are already in the correct format
    return searchResults.items;
  }, [
    searchResults.items,
    searchResults.hasActiveSearch,
    searchResults.isSearching,
    searchResults.isLoading,
  ]);

  // Use search results when actively searching, otherwise show paginated items
  const displayItems = searchItems ?? items;
  const showLoadMore = !searchResults.hasActiveSearch && hasNextPage;
  const displayTotal = searchResults.hasActiveSearch
    ? searchResults.total
    : total;

  return (
    <ItemsGrid
      items={displayItems}
      hasActiveSearch={searchResults.hasActiveSearch}
      onClearSearch={clearAll}
      hasMore={showLoadMore}
      isLoadingMore={isFetchingNextPage}
      onLoadMore={loadMore}
      total={displayTotal}
      initialNoteDraft={initialNoteDraft}
    />
  );
}
