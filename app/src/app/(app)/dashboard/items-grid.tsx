"use client";

import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import { Home, SearchX } from "lucide-react";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AbodeLogo } from "@/components/abode-logo";
import { Button } from "@/components/ui/button";
import { useColumnWidth } from "@/hooks/use-column-width";
import { useGridDensity } from "@/hooks/use-grid-density";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useRootFontSize } from "@/hooks/use-root-font-size";
import { getBookTileFrame } from "@/lib/book-cover";
import {
  estimateNoteAspect,
  estimateTweetAspect,
} from "@/lib/items/card-aspect";
import { measureCardText } from "@/lib/items/card-text-measurer";
import { isFreshlyAdded } from "@/lib/items/grow-in";
import { getItemDisplayName } from "@/lib/items/item-display-name";
import { readAspectHint } from "@/lib/items/provisional-aspect";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { Item } from "@/lib/types/item";
import { MAX_IMAGE_UPLOAD_LABEL } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { ItemCard } from "./item-card";
import { ItemCardSkeleton, shuffleSkeletonFrames } from "./item-card-skeleton";
import { ItemFrame } from "./item-frame";
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
  // Actual rendered column width — coverless text cards (notes, text tweets)
  // size their height from their content against this width.
  const columnWidth = useColumnWidth({
    ref: containerRef,
    frameWidth,
    gap,
    enabled: hasHydrated,
  });
  // Card root font size in px: gridCardStyle sets font-size to
  // calc(var(--grid-font-scale) * 1rem), so 1em on a card is fontScale × the
  // live root rem (not a hard-coded 16px — respects the user's font-size pref).
  const rootRemPx = useRootFontSize();
  const cardRootPx = fontScale * rootRemPx;
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

  // Enable the frame transition only after the first paint. The masonry engine
  // sets each frame's `transform` on its initial (synchronous) layout;
  // transitioning that from the start would cascade every card in from the top
  // on load. Once mounted, when a card finishing analysis changes its aspect,
  // both animate together over the same duration: `transform` slides its
  // neighbours (the reflow) and `aspect-ratio` resizes its own box — so the
  // card grows into the slot the reflow opens instead of snapping and
  // overlapping. (We transition `aspect-ratio` directly rather than via an
  // @property number var, because Tailwind/Lightning CSS strips hand-authored
  // @property rules from the build.)
  const [enableFrameTransition, setEnableFrameTransition] = useState(false);
  useEffect(() => setEnableFrameTransition(true), []);
  const frameTransition = enableFrameTransition
    ? "transform 0.3s ease, aspect-ratio 0.3s ease"
    : undefined;

  // Grow newly-added items into the grid instead of popping them in at full
  // height. Seed the set with the items present on first render so the initial
  // load doesn't animate; anything that appears later and isn't in the set (and
  // was created recently) is a fresh insert. Pagination/search bring in older
  // items, which fail the freshness check and appear instantly.
  const prefersReducedMotion = usePrefersReducedMotion();
  const seenItemIdsRef = useRef<Set<string> | null>(null);
  if (seenItemIdsRef.current === null) {
    seenItemIdsRef.current = new Set(items.map((item) => item.id));
  }
  const seenItemIds = seenItemIdsRef.current;
  useEffect(() => {
    const seen = seenItemIdsRef.current;
    if (seen) for (const item of items) seen.add(item.id);
  }, [items]);

  if (!hasHydrated) {
    return null;
  }

  // While a search is in flight, dim the shown state and block interaction so
  // both the grid and a retained empty ("No results") state read as loading.
  const busyClass = isSearchPending
    ? "pointer-events-none opacity-50 transition-opacity"
    : undefined;

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
          <div
            className={cn(
              "flex min-h-[calc(100vh-18rem)] w-full items-center justify-center rounded-xl border border-border border-dashed bg-muted/20 px-6 py-12 text-center",
              busyClass,
            )}
            aria-busy={isSearchPending}
          >
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
          className={cn(items.length <= 4 && "flex justify-center", busyClass)}
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
              const isInstagram = item.kind === "instagram";
              const isVideo = item.kind === "video";
              const isProduct = item.kind === "product";
              const isBook = item.kind === "book";
              const isNote = item.kind === "note";
              // A URL whose kind hasn't resolved yet — still processing or
              // failed. Both render the icon placeholder card and should share
              // the provisional aspect so it doesn't snap between states.
              const isUnresolvedUrl =
                item.sourceType === "url" && item.kind === null;

              const name = getItemDisplayName(item);

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
                } else if (columnWidth !== null && item.twitterDetails?.text) {
                  // Text-only tweet: height follows the tweet text
                  ({ width, height } = estimateTweetAspect(
                    {
                      text: item.twitterDetails.text,
                      hasAvatar: !!item.twitterDetails.authorAvatarUrl,
                    },
                    {
                      columnWidthPx: columnWidth,
                      rootRemPx,
                      measure: measureCardText,
                    },
                  ));
                } else {
                  // Text-only tweet placeholder (pre-measurement / no text)
                  width = 16;
                  height = 12;
                }
              } else if (isInstagram) {
                const coverIndex = item.instagramDetails?.coverMediaIndex ?? 0;
                const coverMedia =
                  item.instagramDetails?.media?.[coverIndex] ??
                  item.instagramDetails?.media?.[0];
                if (coverMedia?.width && coverMedia?.height) {
                  width = coverMedia.width;
                  height = coverMedia.height;
                } else {
                  // OG covers carry no dimensions; Instagram posts are ~square
                  width = 1;
                  height = 1;
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
              } else if (isUnresolvedUrl) {
                // Use the insert-time aspect hint (video/twitter) when present
                // so the card lands at its final shape; otherwise 4:3.
                const hint = readAspectHint(meta);
                width = hint?.width ?? 4;
                height = hint?.height ?? 3;
              } else if (isArticleOrWebpage) {
                width = 4;
                height = 3;
              } else if (isNote) {
                if (columnWidth !== null) {
                  // Coverless text card: height follows the note's content
                  ({ width, height } = estimateNoteAspect(
                    {
                      title: item.title,
                      body: item.noteDetails?.content ?? "",
                    },
                    {
                      columnWidthPx: columnWidth,
                      cardRootPx,
                      rootRemPx,
                      measure: measureCardText,
                    },
                  ));
                } else {
                  // Square sticky note until we've measured the column
                  width = 1;
                  height = 1;
                }
              } else {
                width = (meta.width as number | undefined) ?? 3;
                height = (meta.height as number | undefined) ?? 4;
              }

              const animateIn =
                !prefersReducedMotion &&
                !seenItemIds.has(item.id) &&
                isFreshlyAdded(item.createdAt, Date.now());

              return (
                <ItemFrame
                  key={item.id}
                  width={width}
                  height={height}
                  columnWidth={columnWidth}
                  frameTransition={frameTransition}
                  animateIn={animateIn}
                >
                  <ItemCard
                    item={item}
                    name={name}
                    size={size}
                    mimeType={mimeType}
                  />
                </ItemFrame>
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
