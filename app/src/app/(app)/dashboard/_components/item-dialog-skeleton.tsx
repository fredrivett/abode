"use client";

import { BlurImage } from "@/components/ui/blur-image";
import { DialogTitle } from "@/components/ui/dialog";
import { getProxyImageUrl } from "@/lib/image-url";
import type { OpenItemSeed } from "../item-dialog-context";

/**
 * Loading body for the detail dialog, shown inside the shared ItemDialogFrame
 * while an item opened from outside the grid (a "similar images" click) is still
 * being fetched. Just the panes — the seed image + skeleton sidebar rows — so it
 * swaps in and out of the one mounted dialog without remounting it.
 */
export function ItemDialogSkeletonBody({ seed }: { seed: OpenItemSeed }) {
  const src = seed.imageFileKey
    ? getProxyImageUrl(seed.imageFileKey, "grid")
    : null;

  return (
    <>
      <DialogTitle className="sr-only">
        {seed.title ?? "Loading item"}
      </DialogTitle>
      {/* Image pane — the one thing we already have, shown straight away.
          `relative overflow-hidden` so BlurImage's absolute placeholder is
          contained here rather than escaping to fill the whole dialog. */}
      <div className="relative flex shrink-0 items-center justify-center overflow-hidden bg-gray-900 md:flex-1">
        {src ? (
          <BlurImage
            src={src}
            alt={seed.title ?? "Loading image"}
            blurDataUrl={seed.blurDataUrl}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-muted" />
        )}
      </div>
      {/* Sidebar — title we have, the rest as skeleton rows */}
      <div className="flex flex-col gap-4 border-border border-t bg-background p-6 md:w-[400px] md:border-t-0 md:border-l">
        <div className="font-semibold text-lg">
          {seed.title ?? (
            <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
          )}
        </div>
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-24 w-full animate-pulse rounded bg-muted" />
      </div>
    </>
  );
}
