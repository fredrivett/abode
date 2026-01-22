"use client";

import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import { Home, SearchX } from "lucide-react";
import { AbodeLogo } from "@/components/abode-logo";
import { Button } from "@/components/ui/button";
import { IsLoading } from "@/components/ui/is-loading";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { Item } from "@/lib/types/item";
import { MAX_IMAGE_UPLOAD_LABEL } from "@/lib/uploads";
import { ItemCard } from "./item-card";

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${
    units[exponent]
  }`;
}

type ItemsGridProps = {
  items: Item[];
  hasActiveSearch?: boolean;
  onClearSearch?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  total?: number;
};

export function ItemsGrid({
  items,
  hasActiveSearch,
  onClearSearch,
  hasMore,
  isLoadingMore,
  onLoadMore,
  total,
}: ItemsGridProps) {
  const { ref: loadMoreRef } = useInfiniteScroll({
    hasMore: hasMore ?? false,
    isLoading: isLoadingMore ?? false,
    onLoadMore: onLoadMore ?? (() => {}),
  });

  return (
    <div className="flex-1 flex flex-col w-full space-y-3">
      {items.length === 0 ? (
        hasActiveSearch ? (
          // Empty state for search with no results
          <div className="flex min-h-[calc(100vh-18rem)] w-full items-center justify-center rounded-xl border border-border border-dashed bg-muted/20 px-6 py-12 text-center">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
              <SearchX className="size-14 text-muted-foreground" />
              <div className="space-y-2">
                <h2 className="font-semibold font-serif text-3xl">
                  No results found
                </h2>
                <p className="text-base text-muted-foreground">
                  We couldn't find any items matching your search. Try adjusting
                  your filters or search terms.
                </p>
                {onClearSearch && (
                  <Button
                    variant="outline"
                    onClick={onClearSearch}
                    className="mt-4"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Empty state for no items at all
          <div className="flex min-h-[calc(100vh-18rem)] w-full items-center justify-center rounded-xl border border-border border-dashed bg-muted/20 px-6 py-12 text-center">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
              <Home className="size-14 text-muted-foreground" />
              <div className="space-y-2">
                <h2 className="font-semibold font-serif text-3xl">
                  Welcome home
                </h2>
                <p className="text-base text-muted-foreground">
                  Drag and drop an image anywhere on this page to upload your
                  first item to{" "}
                  <span className="inline-flex items-baseline">
                    <span className="sr-only">Abode</span>
                    <AbodeLogo
                      className="ml-1 h-[0.8em] w-auto text-muted-foreground"
                      aria-hidden
                    />
                  </span>
                  . We'll analyze it automatically so it's easy to search and
                  organize later.
                </p>
                <div className="mx-auto my-4 h-px w-36 bg-border" />
                <p className="text-muted-foreground text-xs">
                  JPG, PNG, GIF, or WEBP up to {MAX_IMAGE_UPLOAD_LABEL}
                </p>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className={items.length <= 4 ? "flex justify-center" : ""}>
          <BalancedMasonryGrid
            frameWidth={250}
            gap={16}
            style={{ overflow: "visible !important" }}
          >
            {items.map((item) => {
              const meta = item.meta || {};
              const isArticle = item.kind === "article";
              const isTwitter = item.kind === "twitter";
              const isProcessingUrl =
                item.sourceType === "url" &&
                item.processingStatus === "processing";

              // Derive display name - item.title is the single source of truth
              let name: string;
              if (isProcessingUrl && item.sourceUrl) {
                // For processing URLs, show the domain as the name
                try {
                  name = new URL(item.sourceUrl).hostname;
                } catch {
                  name = "Processing URL";
                }
              } else {
                name = item.title ?? "Untitled";
              }

              const size = formatBytes(meta.size as number | undefined);
              const mimeType = meta.type as string | undefined;

              // Calculate aspect ratio based on item type
              // - Twitter: 16:18 (taller) for tweets with media, 16:12 for text-only
              // - Articles and processing URLs: 16:9
              // - Images: actual dimensions or 3:4 default
              let width: number;
              let height: number;
              if (isTwitter) {
                const hasVisualContent =
                  item.twitterDetails?.media?.length ||
                  item.twitterDetails?.card?.imageUrl;
                width = 16;
                height = hasVisualContent ? 18 : 12;
              } else if (isArticle || isProcessingUrl) {
                width = 16;
                height = 9;
              } else {
                width = (meta.width as number | undefined) ?? 3;
                height = (meta.height as number | undefined) ?? 4;
              }

              return (
                <Frame key={item.id} width={width} height={height}>
                  <div className="h-full">
                    <ItemCard
                      item={item}
                      name={name}
                      size={size}
                      mimeType={mimeType}
                    />
                  </div>
                </Frame>
              );
            })}
          </BalancedMasonryGrid>
        </div>
      )}

      {/* Infinite scroll trigger and loading indicator */}
      {items.length > 0 && (
        <div ref={loadMoreRef} className="flex justify-center pt-18 mt-auto">
          {isLoadingMore && (
            <IsLoading
              label="Loading more"
              iconClassName="size-5"
              className="text-muted-foreground"
            />
          )}
          {!hasMore &&
            items.length > 0 &&
            total !== undefined &&
            (hasActiveSearch || total > DEFAULT_PAGE_SIZE) && (
              <div className="text-center font-serif text-muted-foreground/50 text-base italic">
                {hasActiveSearch
                  ? `Showing ${total > 1 ? "all " : ""}${total} ${total === 1 ? "result" : "results"}`
                  : `Showing all ${total} items`}
                <div className="cursor-default mt-6 text-2xl text-muted-foreground/25">
                  ~~~
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
