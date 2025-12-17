"use client";

import type { ItemKind } from "@prisma/client";
import { useMemo } from "react";
import { useSearch, useSearchResults } from "@/lib/search";
import { type DashboardItem, ItemsGrid } from "./items-grid";

type SearchableItemsGridProps = {
  initialItems: DashboardItem[];
};

export function SearchableItemsGrid({ initialItems }: SearchableItemsGridProps) {
  const { state: searchState, clearAll } = useSearch();
  const searchResults = useSearchResults(searchState);

  // Convert search results to dashboard item format
  const searchItems = useMemo((): DashboardItem[] | null => {
    if (!searchResults.hasActiveSearch) {
      return null;
    }

    return searchResults.items.map((item) => ({
      id: item.id,
      kind: item.kind as ItemKind | null,
      processingStatus: "completed",
      fileKey: item.fileKey,
      meta: null,
      sourceType: null,
      sourceUrl: null,
      coverFileKey: item.coverFileKey,
      createdAt: item.createdAt,
      title: item.title,
      description: null,
      tags: item.tags,
      objects: [],
      colors: item.colors?.map((c) => ({ ...c, name: "", score: 0 })) ?? [],
      ocrText: null,
      locations: [],
      articleDetails: null,
    }));
  }, [searchResults.items, searchResults.hasActiveSearch]);

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
