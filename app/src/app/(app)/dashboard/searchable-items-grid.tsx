"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { useSearch, useSearchResults } from "@/lib/search";
import type { Item } from "@/lib/types/item";
import { useProcessingPoll } from "@/lib/use-processing-poll";
import { ItemsGrid } from "./items-grid";

type SearchableItemsGridProps = {
  initialItems: Item[];
  initialCursor: string | null;
  initialHasMore: boolean;
  initialTotal: number;
};

export function SearchableItemsGrid({
  initialItems,
  initialCursor,
  initialHasMore,
  initialTotal,
}: SearchableItemsGridProps) {
  const { state: searchState, clearAll } = useSearch();
  const searchResults = useSearchResults(searchState);

  // Pagination state for non-search mode
  const [items, setItems] = useState<Item[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  // Load more items
  const loadMore = useCallback(async () => {
    if (!cursor || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/v1/items?cursor=${cursor}&limit=${DEFAULT_PAGE_SIZE}`,
      );
      if (!response.ok) {
        throw new Error("Failed to load more items");
      }

      const data = await response.json();
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.cursor);
      setHasMore(data.hasMore);
    } catch {
      toast.error("Failed to load more items. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore, hasMore]);

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
  const showLoadMore = !searchResults.hasActiveSearch && hasMore;

  return (
    <ItemsGrid
      items={displayItems}
      hasActiveSearch={searchResults.hasActiveSearch}
      onClearSearch={clearAll}
      hasMore={showLoadMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMore}
      total={initialTotal}
    />
  );
}
