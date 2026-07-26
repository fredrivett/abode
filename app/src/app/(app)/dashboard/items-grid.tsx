"use client";

import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import { Home, SearchX } from "lucide-react";
import { type CSSProperties, useMemo } from "react";
import { AbodeLogo } from "@/components/abode-logo";
import { Button } from "@/components/ui/button";
import { useGridDensity } from "@/hooks/use-grid-density";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { getBookTileFrame } from "@/lib/book-cover";
import { noteDisplayName } from "@/lib/items/note-title";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { Item } from "@/lib/types/item";
import { MAX_IMAGE_UPLOAD_LABEL } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { ItemCard } from "./item-card";
import { ItemCardSkeleton, shuffleSkeletonFrames } from "./item-card-skeleton";
import { NoteComposer } from "./note-composer";

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
  /** Show the note composer (the full-list view, not resolved search results) */
  showComposer?: boolean;
  /** Dim and disable the whole grid while a search is in flight */
  isSearchPending?: boolean;
  onClearSearch?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  total?: number;
  /** Server-rendered composer draft, passed straight to the note composer */
  initialNoteDraft?: string | null;
};

/**
 * Masonry grid of items with infinite scroll, empty states, and result count footer.
 */
export function ItemsGrid({
  items,
  hasActiveSearch,
  showComposer,
  isSearchPending,
  onClearSearch,
  hasMore,
  isLoadingMore,
  onLoadMore,
  total,
  initialNoteDraft,
}: ItemsGridProps) {
  const {
    frameWidth,
    gap,
    borderRadius,
    fontScale,
    containerRef,
    hasHydrated,
  } = useGridDensity();
  const { ref: loadMoreRef } = useInfiniteScroll({
    hasMore: hasMore ?? false,
    isLoading: isLoadingMore ?? false,
    onLoadMore: onLoadMore ?? (() => {}),
  });

  // Fresh random order per load; stable across re-renders while loading so the
  // placeholders don't reshuffle mid-fetch.
  const skeletonFrames = useMemo(
    () => (isLoadingMore ? shuffleSkeletonFrames() : []),
    [isLoadingMore],
  );

  if (!hasHydrated) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="flex w-full flex-1 flex-col space-y-3"
      style={
        {
          "--grid-border-radius": `${borderRadius}px`,
          "--grid-font-scale": fontScale,
        } as CSSProperties
      }
    >
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
        <div
          className={cn(
            items.length <= 4 && "flex justify-center",
            // Dim + block the whole grid while search results are loading
            isSearchPending &&
              "pointer-events-none opacity-50 transition-opacity",
          )}
          aria-busy={isSearchPending}
        >
          <BalancedMasonryGrid
            frameWidth={frameWidth}
            gap={gap}
            style={{ overflow: "visible !important" }}
          >
            {/* The note composer lives in the grid as the first card. It stays
                on the full-list view (including while the first search is still
                in flight, just disabled) and is hidden once results are shown,
                so it doesn't reflow the grid the instant the user types. */}
            {showComposer && (
              <Frame key="note-composer" width={1} height={1}>
                <div className="h-full">
                  <NoteComposer
                    initialDraft={initialNoteDraft}
                    disabled={isSearchPending}
                  />
                </div>
              </Frame>
            )}
            {items.map((item) => {
              const meta = item.meta || {};
              const isArticleOrWebpage =
                item.kind === "article" || item.kind === "webpage";
              const isTwitter = item.kind === "twitter";
              const isVideo = item.kind === "video";
              const isProduct = item.kind === "product";
              const isBook = item.kind === "book";
              const isNote = item.kind === "note";
              const isProcessingUrl =
                item.sourceType === "url" &&
                item.processingStatus === "processing";

              // Derive display name - item.title is the single source of truth
              let name: string;
              if (isProcessingUrl && !item.title && item.sourceUrl) {
                // For processing URLs without a title yet, show the domain
                try {
                  name = new URL(item.sourceUrl).hostname;
                } catch {
                  name = "Processing URL";
                }
              } else if (isNote && !item.title) {
                // Title-less notes (body doesn't open with a heading) fall back
                // to their first line rather than showing "Untitled"
                name =
                  noteDisplayName(item.noteDetails?.content ?? "") ??
                  "Untitled";
              } else {
                name = item.title ?? "Untitled";
              }

              const size = formatBytes(meta.size as number | undefined);
              const mimeType = meta.type as string | undefined;

              // Calculate aspect ratio based on item type
              // - Twitter: cover media's natural aspect; falls back to card image / text-only defaults
              // - Video: 16:9 (YouTube/Vimeo thumbnails are always 16:9)
              // - Articles, webpages, and processing URLs: 4:3
              // - Images: actual dimensions or 3:4 default
              let width: number;
              let height: number;
              if (isTwitter) {
                const coverIndex = item.twitterDetails?.coverMediaIndex ?? 0;
                const coverMedia =
                  item.twitterDetails?.media?.[coverIndex] ??
                  item.twitterDetails?.media?.[0];
                const hasCardImage = !!item.twitterDetails?.card?.imageUrl;
                if (coverMedia?.width && coverMedia?.height) {
                  width = coverMedia.width;
                  height = coverMedia.height;
                } else if (hasCardImage) {
                  // Twitter link-card images render at ~1.91:1
                  width = 16;
                  height = 9;
                } else {
                  // Text-only tweet placeholder
                  width = 16;
                  height = 12;
                }
              } else if (isVideo) {
                // New videos persist thumbnail dims into meta; older ones fall back to 16:9
                width = (meta.width as number | undefined) ?? 16;
                height = (meta.height as number | undefined) ?? 9;
              } else if (isProduct) {
                const coverIndex = item.productDetails?.coverImageIndex ?? 0;
                const coverImage = item.productDetails?.images?.[coverIndex];
                if (coverImage?.width && coverImage?.height) {
                  width = coverImage.width;
                  height = coverImage.height;
                } else {
                  // Most product photography is squarish to portrait
                  width = 1;
                  height = 1;
                }
              } else if (isBook) {
                // Cover's ingested aspect ratio plus equal padding all round
                ({ width, height } = getBookTileFrame(item.meta));
              } else if (isArticleOrWebpage || isProcessingUrl) {
                width = 4;
                height = 3;
              } else if (isNote) {
                // Notes are coverless text cards; a square sticky note
                width = 1;
                height = 1;
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
            {/* While the next page loads, tease it with skeleton cards so the
                grid grows in place rather than showing a spinner below it. */}
            {skeletonFrames.map(({ id, width, height }) => (
              <Frame key={id} width={width} height={height}>
                <div className="h-full">
                  <ItemCardSkeleton />
                </div>
              </Frame>
            ))}
          </BalancedMasonryGrid>
        </div>
      )}

      {/* Infinite scroll trigger and end-of-list footer */}
      {items.length > 0 && (
        <div ref={loadMoreRef} className="mt-auto flex justify-center pt-18">
          {!hasMore &&
            items.length > 0 &&
            total !== undefined &&
            (hasActiveSearch || total > DEFAULT_PAGE_SIZE) && (
              <div className="text-center font-serif text-base text-muted-foreground/50 italic">
                {hasActiveSearch
                  ? `Showing ${total > 1 ? "all " : ""}${total} ${total === 1 ? "result" : "results"}`
                  : `Showing all ${total} items`}
                <div className="mt-6 cursor-default text-2xl text-muted-foreground/25">
                  ~~~
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
