"use client";

import { Home, SearchX } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef } from "react";
import { AbodeLogo } from "@/components/abode-logo";
import { MasonryGrid } from "@/components/masonry/masonry-grid";
import { Button } from "@/components/ui/button";
import { useGridDensity } from "@/hooks/use-grid-density";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { diffItemIds } from "@/lib/debug/grid-layout-diff";
import { debugTrace, isTracing } from "@/lib/debug/trace";
import { useDebugGridObserver } from "@/lib/debug/use-debug-grid-observer";
import { useDebugLifecycle } from "@/lib/debug/use-debug-lifecycle";
import { isFreshlyAdded } from "@/lib/items/grow-in";
import { getItemDisplayName } from "@/lib/items/item-display-name";
import { useCardFrame } from "@/lib/items/use-card-frame";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { Item } from "@/lib/types/item";
import { MAX_IMAGE_UPLOAD_LABEL } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { ItemCard } from "./item-card";
import {
  ItemCardSkeleton,
  type SKELETON_FRAMES,
  shuffleSkeletonFrames,
} from "./item-card-skeleton";
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

// What the grid lays out: the note composer as the first card, the items, and
// skeletons teasing the next page while it loads
type GridEntry =
  | { type: "composer" }
  | { type: "item"; item: Item }
  | { type: "skeleton"; frame: (typeof SKELETON_FRAMES)[number] };

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
  const getCardFrame = useCardFrame(fontScale);
  const { ref: loadMoreRef } = useInfiniteScroll({
    hasMore: hasMore ?? false,
    isLoading: isLoadingMore ?? false,
    onLoadMore: onLoadMore ?? (() => {}),
  });

  // Debug trace (no-ops unless an admin has tracing on): masonry reflows, list
  // changes, and the geometry/loading inputs that drive them
  const gridDebugRef = useDebugGridObserver();
  useDebugLifecycle({
    name: "ItemsGrid",
    channel: "grid",
    watch: {
      itemCount: items.length,
      frameWidth,
      isLoadingMore,
      isSearchPending,
      hasMore,
    },
  });
  // null until the first render's ids are recorded (an empty list is a real state)
  const prevItemIdsRef = useRef<string[] | null>(null);
  useEffect(() => {
    const ids = items.map((item) => item.id);
    const prev = prevItemIdsRef.current;
    prevItemIdsRef.current = ids;
    if (!isTracing() || prev === null) return;
    const diff = diffItemIds({ prev, next: ids });
    if (diff.added || diff.removed || diff.reordered) {
      debugTrace("grid", "items", { count: ids.length, ...diff });
    }
  }, [items]);

  // Fresh random order per load; stable across re-renders while loading so the
  // placeholders don't reshuffle mid-fetch.
  const skeletonFrames = useMemo(
    () => (isLoadingMore ? shuffleSkeletonFrames() : []),
    [isLoadingMore],
  );

  // The note composer lives in the grid as the first card. It stays on the
  // full-list view (including while the first search is still in flight, just
  // disabled) and is hidden once results are shown, so it doesn't reflow the
  // grid the instant the user types. Skeletons tease the next page while it
  // loads, so the grid grows in place rather than showing a spinner below it.
  const entries = useMemo(
    (): GridEntry[] => [
      ...(showComposer ? [{ type: "composer" as const }] : []),
      ...items.map((item) => ({ type: "item" as const, item })),
      ...skeletonFrames.map((frame) => ({ type: "skeleton" as const, frame })),
    ],
    [showComposer, items, skeletonFrames],
  );

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
          ref={gridDebugRef}
          className={busyClass}
          aria-busy={isSearchPending}
        >
          <MasonryGrid<GridEntry>
            items={entries}
            getKey={(entry) =>
              entry.type === "composer"
                ? "note-composer"
                : entry.type === "item"
                  ? entry.item.id
                  : entry.frame.id
            }
            getFrame={(entry, geometry) =>
              // Pinned to the first column: as the first entry that's top-left,
              // even when it rejoins a laid-out grid (search cleared) and
              // would otherwise balance into the shortest column
              entry.type === "composer"
                ? { width: 1, height: 1, column: 0 }
                : entry.type === "item"
                  ? getCardFrame(entry.item, geometry)
                  : entry.frame
            }
            minColumnWidth={frameWidth}
            gap={gap}
            animate
            // Grow freshly-added items in (an upload, a new note) rather than
            // popping them in; pagination/search bring in older items, which
            // aren't fresh and appear instantly
            shouldGrowIn={(entry) =>
              entry.type === "item" &&
              isFreshlyAdded(entry.item.createdAt, Date.now())
            }
            renderItem={(entry) => {
              if (entry.type === "composer") {
                return (
                  <NoteComposer
                    initialDraft={initialNoteDraft}
                    disabled={isSearchPending}
                  />
                );
              }
              if (entry.type === "skeleton") return <ItemCardSkeleton />;
              const { item } = entry;
              const meta = item.meta || {};
              return (
                <ItemCard
                  item={item}
                  name={getItemDisplayName(item)}
                  size={formatBytes(meta.size as number | undefined)}
                  mimeType={meta.type as string | undefined}
                />
              );
            }}
          />
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
