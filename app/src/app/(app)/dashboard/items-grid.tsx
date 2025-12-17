"use client";

import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import type { ItemKind, ProcessingStatus, SourceType } from "@prisma/client";
import { Home, SearchX } from "lucide-react";
import { AbodeLogo } from "@/components/abode-logo";
import { Button } from "@/components/ui/button";
import { MAX_IMAGE_UPLOAD_LABEL } from "@/lib/uploads";
import type { ImageColor } from "@/lib/vision";
import { ItemCard } from "./item-card";

type ItemLocation = {
  id: string;
  source: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  formatted: string | null;
};

type ArticleDetails = {
  author: string | null;
  domain: string | null;
  publishedAt: string | null;
  readingTime: number | null;
};

type DashboardItem = {
  id: string;
  kind: ItemKind | null;
  processingStatus: ProcessingStatus;
  fileKey: string | null;
  meta: Record<string, unknown> | null;
  sourceType: SourceType | null;
  sourceUrl: string | null;
  coverFileKey: string | null;
  createdAt: string;
  title: string | null;
  description: string | null;
  tags: string[];
  objects: string[];
  colors: ImageColor[];
  ocrText: string | null;
  locations: ItemLocation[];
  articleDetails: ArticleDetails | null;
};

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
  items: DashboardItem[];
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
          <div className="flex min-h-[calc(100vh-14rem)] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
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
          <div className="flex min-h-[calc(100vh-14rem)] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
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
        <BalancedMasonryGrid
          frameWidth={250}
          gap={16}
          style={{ overflow: "visible !important" }}
        >
          {items.map((item) => {
            const meta = item.meta || {};
            const isArticle = item.kind === "article";

            // For articles, prefer title; for images, prefer meta name
            const name = isArticle
              ? (item.title ?? item.articleDetails?.domain ?? "Untitled")
              : ((meta.name as string | undefined) ??
                (meta.originalName as string | undefined) ??
                item.title ??
                item.fileKey ??
                "Untitled");

            const size = formatBytes(meta.size as number | undefined);
            const mimeType = meta.type as string | undefined;

            // For articles, use 16:9 aspect ratio; for images use actual dimensions or 3:4
            const width = isArticle
              ? 16
              : ((meta.width as number | undefined) ?? 3);
            const height = isArticle
              ? 9
              : ((meta.height as number | undefined) ?? 4);

            return (
              <Frame key={item.id} width={width} height={height}>
                <ItemCard
                  item={item}
                  name={name}
                  size={size}
                  mimeType={mimeType}
                />
              </Frame>
            );
          })}
        </BalancedMasonryGrid>
      )}
    </div>
  );
}
