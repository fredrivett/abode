"use client";

import { useMemo } from "react";
import { useSearch, useSearchResults } from "@/lib/search";
import type { Item } from "@/lib/types/item";
import { useProcessingPoll } from "@/lib/use-processing-poll";
import { ItemsGrid } from "./items-grid";

type SearchableItemsGridProps = {
  initialItems: Item[];
};

export function SearchableItemsGrid({
  initialItems,
}: SearchableItemsGridProps) {
  const { state: searchState, clearAll } = useSearch();
  const searchResults = useSearchResults(searchState);

  // Get IDs of items that are still processing
  const processingItemIds = useMemo(
    () =>
      initialItems
        .filter((item) => item.processingStatus === "processing")
        .map((item) => item.id),
    [initialItems],
  );

  // Poll for status updates on processing items
  useProcessingPoll(processingItemIds);

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

  // Use search results when actively searching, otherwise show all items
  const displayItems = searchItems ?? initialItems;

  return (
    <ItemsGrid
      items={displayItems}
      hasActiveSearch={searchResults.hasActiveSearch}
      onClearSearch={clearAll}
    />
  );
}
