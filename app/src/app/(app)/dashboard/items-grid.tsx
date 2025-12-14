"use client";

import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import { Home } from "lucide-react";
import { AbodeLogo } from "@/components/abode-logo";
import { MAX_IMAGE_UPLOAD_LABEL } from "@/lib/uploads";
import type { ImageColor } from "@/lib/vision";
import { ItemCard } from "./item-card";

type DashboardItem = {
  id: string;
  kind: string;
  processingStatus: string;
  fileKey: string | null;
  meta: Record<string, unknown> | null;
  source: string | null;
  createdAt: string;
  title: string | null;
  description: string | null;
  tags: string[];
  objects: string[];
  colors: ImageColor[];
  ocrText: string | null;
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

export function ItemsGrid({ items }: { items: DashboardItem[] }) {
  return (
    <div className="w-full space-y-3">
      {items.length === 0 ? (
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
                . We’ll analyze it automatically so it’s easy to search and
                organize later.
              </p>
              <div className="mx-auto my-4 h-px w-36 bg-border" />
              <p className="text-xs text-muted-foreground">
                JPG, PNG, GIF, or WEBP up to {MAX_IMAGE_UPLOAD_LABEL}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <BalancedMasonryGrid
          frameWidth={250}
          gap={16}
          style={{ overflow: "visible !important" }}
        >
          {items.map((item) => {
            const meta = item.meta || {};
            const name =
              (meta.name as string | undefined) ??
              (meta.originalName as string | undefined) ??
              item.fileKey ??
              "Untitled";
            const size = formatBytes(meta.size as number | undefined);
            const mimeType = meta.type as string | undefined;

            // Use actual image dimensions if available, fallback to 3:4 aspect ratio
            const width = (meta.width as number | undefined) ?? 3;
            const height = (meta.height as number | undefined) ?? 4;

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
