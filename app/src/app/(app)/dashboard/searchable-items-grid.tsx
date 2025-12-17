"use client";

import type {
  ItemKind,
  ProcessingStatus,
  SourceType,
} from "@prisma/client";
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
      colors: item.colors?.map((c) => ({ ...c, name: c.name ?? "", score: 0 })) ?? [],
      ocrText: item.ocrText,
      locations: item.locations,
      articleDetails: item.articleDetails,
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
