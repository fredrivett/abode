"use client";

import { BalancedMasonryGrid, Frame } from "@masonry-grid/react";
import { ItemCard } from "./item-card";

type DashboardItem = {
  id: string;
  kind: string;
  processingStatus: string;
  fileKey: string | null;
  meta: Record<string, unknown> | null;
  source: string | null;
  createdAt: string;
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

export function UploadsList({ items }: { items: DashboardItem[] }) {
  return (
    <div className="w-full max-w-7xl space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No uploads yet.
        </p>
      ) : (
        <BalancedMasonryGrid
          frameWidth={250}
          gap={16}
          style={{ overflow: "visible !important" }}
        >
          {items.map((item) => {
            const meta = item.meta || {};
            const name =
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
