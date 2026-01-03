"use client";

import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import { Home, SearchX } from "lucide-react";
import { AbodeLogo } from "@/components/abode-logo";
import { Button } from "@/components/ui/button";
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
};

export function ItemsGrid({
  items,
  hasActiveSearch,
  onClearSearch,
}: ItemsGridProps) {
  return (
    <div className="w-full space-y-3">
      {items.length === 0 ? (
        hasActiveSearch ? (
          // Empty state for search with no results
          <div className="flex min-h-[calc(100vh-18rem)] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
              <SearchX className="size-14 text-muted-foreground" />
              <div className="space-y-2">
                <h2 className="text-3xl font-serif font-semibold">
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
          <div className="flex min-h-[calc(100vh-18rem)] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
              <Home className="size-14 text-muted-foreground" />
              <div className="space-y-2">
                <h2 className="text-3xl font-serif font-semibold">
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
                <p className="text-xs text-muted-foreground">
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

            // For articles and processing URLs, use 16:9 aspect ratio; for images use actual dimensions or 3:4
            const width =
              isArticle || isProcessingUrl
                ? 16
                : ((meta.width as number | undefined) ?? 3);
            const height =
              isArticle || isProcessingUrl
                ? 9
                : ((meta.height as number | undefined) ?? 4);

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
    </div>
  );
}
