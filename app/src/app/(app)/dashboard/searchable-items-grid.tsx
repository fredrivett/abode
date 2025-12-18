"use client";

import type { ItemKind, ProcessingStatus, SourceType } from "@prisma/client";
import { useMemo } from "react";
import { useSearch, useSearchResults } from "@/lib/search";
import { useProcessingPoll } from "@/lib/use-processing-poll";
import { type DashboardItem, ItemsGrid } from "./items-grid";

type SearchableItemsGridProps = {
  initialItems: DashboardItem[];
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

  // Convert search results to dashboard item format
  const searchItems = useMemo((): DashboardItem[] | null => {
    // No active search - use initial items
    if (!searchResults.hasActiveSearch) {
      return null;
    }

    // Still searching - keep showing previous items
    if (searchResults.isSearching || searchResults.isLoading) {
      return null;
    }

    // Search complete - show results (even if empty, to display "no results" UI)
    return searchResults.items.map((item) => ({
      id: item.id,
      kind: item.kind as ItemKind | null,
      processingStatus: item.processingStatus as ProcessingStatus,
      fileKey: item.fileKey,
      meta: item.meta,
      sourceType: item.sourceType as SourceType | null,
      sourceUrl: item.sourceUrl,
      coverFileKey: item.coverFileKey,
      createdAt: item.createdAt,
      title: item.title,
      description: item.description,
      tags: item.tags,
      objects: item.objects,
      colors:
        item.colors?.map((c) => ({ ...c, name: c.name ?? "", score: 0 })) ?? [],
      ocrText: item.ocrText,
      locations: item.locations,
      articleDetails: item.articleDetails,
    }));
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
