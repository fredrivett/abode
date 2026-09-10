"use client";

import { BlurImage } from "@/components/ui/blur-image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getProxyImageUrl } from "@/lib/image-url";
import type { OpenItemSeed } from "../item-dialog-context";

/**
 * Loading shell for the detail dialog, shown while an item opened from outside
 * the grid (e.g. a "similar images" click) is still being fetched. Mirrors the
 * real dialog's frame — image pane + sidebar — and paints the seed image and
 * title immediately so the open feels instant, with skeleton rows standing in
 * for the details until the full item lands.
 */
export function ItemDialogSkeleton({
  seed,
  onClose,
}: {
  seed: OpenItemSeed;
  onClose: () => void;
}) {
  const src = seed.imageFileKey
    ? getProxyImageUrl(seed.imageFileKey, "grid")
    : null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="!h-[calc(100vh-1rem)] !max-h-[calc(100vh-1rem)] !w-[calc(100vw-1rem)] !max-w-[calc(100vw-1rem)] md:!h-[calc(100vh-2rem)] md:!max-h-[calc(100vh-2rem)] md:!w-[calc(100vw-2rem)] md:!max-w-[calc(100vw-2rem)] !opacity-100 !bg-transparent !border-0 !shadow-none !scale-100 p-0 [&>button]:hidden"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">
          {seed.title ?? "Loading item"}
        </DialogTitle>
        <div className="h-full w-full overflow-hidden rounded-lg border shadow-lg">
          <div className="flex h-full flex-col md:flex-row md:overflow-hidden">
            {/* Image pane — the one thing we already have, shown straight away */}
            <div className="flex shrink-0 items-center justify-center bg-gray-900 md:flex-1 md:overflow-hidden">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
