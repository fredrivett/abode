"use client";

import type { ItemKind } from "@prisma/client";
import { DialogTitle } from "@/components/ui/dialog";
import { IsLoading } from "@/components/ui/is-loading";
import { getProxyImageUrl } from "@/lib/image-url";
import { DETAIL_IMAGE_CLASSNAME } from "../item-card";
import type { OpenItemSeed } from "../item-dialog-context";

/**
 * Kinds whose resolved detail view *is* the cover shown full-width — so painting
 * the seed cover straight away is seamless. Every other kind renders the cover
 * as a thumbnail of something else (a tweet, a product card, …), so showing it
 * full-width then swapping is jarring; those get a neutral loading pane instead.
 */
const COVER_IS_FULL_VIEW_KINDS: ReadonlySet<ItemKind> = new Set([
  "image",
  "webpage",
]);

/**
 * Loading body for the detail dialog, shown inside the shared ItemDialogFrame
 * while an item opened from outside the grid (a "similar images" click) is still
 * being fetched. Just the panes — the main area + skeleton sidebar rows — so it
 * swaps in and out of the one mounted dialog without remounting it.
 */
export function ItemDialogSkeletonBody({ seed }: { seed: OpenItemSeed }) {
  const showSeedImage =
    seed.imageFileKey !== null &&
    seed.kind !== null &&
    COVER_IS_FULL_VIEW_KINDS.has(seed.kind);
  const src =
    showSeedImage && seed.imageFileKey
      ? getProxyImageUrl(seed.imageFileKey, "grid")
      : null;

  return (
    <>
      <DialogTitle className="sr-only">
        {seed.title ?? "Loading item"}
      </DialogTitle>
      {/* Main pane. For image-like kinds we show the seed cover straight away —
          it *is* the resolved view, so the seed→item swap is seamless (a plain
          <img>, no blur-up, so it matches the resolved pane's box exactly).
          For every other kind the cover is just a thumbnail of something that
          renders differently, so we show a neutral loading pane rather than
          flashing a full-width image that then jumps to a tweet/product/etc. */}
      {src ? (
        <div className="flex shrink-0 items-center justify-center bg-gray-900 md:flex-1 md:overflow-hidden">
          {/* biome-ignore lint/performance/noImgElement: proxy URL for user-uploaded content */}
          <img
            src={src}
            alt={seed.title ?? "Loading image"}
            className={DETAIL_IMAGE_CLASSNAME}
          />
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-center bg-background md:flex-1 md:overflow-hidden">
          <IsLoading label="Loading" />
        </div>
      )}
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
