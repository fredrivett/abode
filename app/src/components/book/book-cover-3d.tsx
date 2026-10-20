"use client";

import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { BlurPlaceholder } from "@/components/ui/blur-placeholder";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { BOOK_PAGE_EDGE_BG, BOOK_SPINE_HINGE_BG } from "@/lib/book-cover";
import { BOOK_3D } from "@/lib/books/cover-perspective";
import { cn } from "@/lib/utils";

type BookCover3DProps = {
  /** Proxy image URL for the cover; null draws `fallback` on a plain board */
  src: string | null;
  /** What's printed on the front when there's no cover image */
  fallback?: ReactNode;
  alt: string;
  /** Shared layout id for the grid → detail morph. */
  layoutId?: string;
  /** Extra classes for the outer (sizing) box. */
  className?: string;
  /**
   * Opaque fill behind the cover image (the cover's dominant color), so the
   * book shows its own primary color instead of a transparent gap while the
   * lazy image loads. Falls back to a neutral surface when absent.
   */
  coverColor?: string;
  /** LQIP placeholder for the cover, shown blurred while the image loads. */
  blurDataUrl?: string | null;
};

/**
 * A faux-3D hardback: back cover + inset page block + front cover rotated
 * open around the spine, so the pages and back board peek out on the right
 * (mymind-style). Hovering opens the cover a little further.
 *
 * The 3D transform lives on inner layers so it never conflicts with the
 * framer layout-morph transform applied to the `layoutId` element — that
 * lets the same book "grow" from a grid tile into the detail view.
 */
export function BookCover3D({
  src,
  fallback,
  alt,
  layoutId,
  className,
  coverColor,
  blurDataUrl,
}: BookCover3DProps) {
  const { loaded: coverLoaded, imgProps } = useImageLoaded(src);
  return (
    <motion.div
      layoutId={layoutId}
      className={cn("group/book relative h-full w-full", className)}
      style={{ containerType: "inline-size" }}
    >
      {/* Perspective in container-query units so the 3D depth is the same
          fraction of the book at every size (px would differ between grid
          tile and detail hero). cqw only resolves against an ANCESTOR
          container, so this must live on a child of the container element */}
      {/* The angles and depth come from BOOK_3D, which the share card's
          flattened copy of this book also projects */}
      <div
        className="relative h-full w-full"
        style={{ perspective: `${BOOK_3D.perspective * 100}cqw` }}
      >
        {/* Contact shadow beneath the book */}
        <div className="absolute inset-x-[8%] bottom-[-5%] h-[9%] rounded-[50%] bg-black/35 blur-lg transition-all duration-300 group-hover/book:bg-black/25" />

        {/* Back cover — same board as the front, in shadow behind the pages */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[2px] rounded-r-[4px] bg-neutral-200 shadow-[2px_4px_12px_rgba(0,0,0,0.35)] dark:bg-neutral-800"
          style={{ backgroundColor: coverColor }}
        >
          {src ? (
            // biome-ignore lint/performance/noImgElement: using proxy URL for stored cover
            <img
              {...imgProps}
              alt=""
              aria-hidden
              className="h-full w-full object-cover brightness-[0.5] saturate-[0.85]"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-black/50" />
          )}
        </div>

        {/* Page block fore-edge — a plane receding from behind the cover's
          fore-edge toward the back board, inset so the boards overhang. It
          starts well left of the cover's projected edge so the printed back
          board never peeks between cover and pages in the resting state */}
        <div
          className="absolute origin-left"
          style={{
            top: `${BOOK_3D.pagesInsetY * 100}%`,
            bottom: `${BOOK_3D.pagesInsetY * 100}%`,
            left: `${BOOK_3D.pagesLeft * 100}%`,
            width: `${BOOK_3D.pagesWidth * 100}%`,
            transform: `rotateY(${BOOK_3D.pagesAngle}deg)`,
            background: BOOK_PAGE_EDGE_BG,
          }}
        />

        {/* Front cover, hinged at the spine and opening toward the viewer */}
        <div
          className="absolute inset-0 origin-left transition-transform duration-300 ease-out [transform:rotateY(var(--book-open))] group-hover/book:[transform:rotateY(-35deg)]"
          style={
            { "--book-open": `-${BOOK_3D.coverAngle}deg` } as CSSProperties
          }
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-[2px] rounded-r-[4px] bg-neutral-200 shadow-[10px_10px_24px_-8px_rgba(0,0,0,0.5)] dark:bg-neutral-800"
            style={{ backgroundColor: coverColor }}
          >
            {src ? (
              // biome-ignore lint/performance/noImgElement: using proxy URL for stored cover
              <img
                {...imgProps}
                alt={alt}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div role="img" aria-label={alt} className="h-full w-full">
                {fallback}
              </div>
            )}
            {blurDataUrl && (
              <BlurPlaceholder
                blurDataUrl={blurDataUrl}
                visible={!coverLoaded}
              />
            )}
            {/* Spine hinge groove down the left edge */}
            <div
              className="absolute inset-y-0 left-0 w-full"
              style={{ background: BOOK_SPINE_HINGE_BG }}
            />
            {/* Board edge catching the light at the fore-edge */}
            <div className="absolute inset-y-0 right-0 w-[2%] bg-gradient-to-l from-white/30 to-transparent" />
            {/* Subtle sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/12 to-transparent" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
