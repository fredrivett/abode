"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type BookCover3DProps = {
  /** Proxy image URL for the cover. */
  src: string;
  alt: string;
  /** Shared layout id for the grid → detail morph. */
  layoutId?: string;
  /** Extra classes for the outer (sizing) box. */
  className?: string;
};

// Page fore-edge: striations under a light-to-shadow wash. Rendered on a
// plane rotated away from the viewer, so the lines foreshorten with depth.
const PAGE_EDGE_BG = [
  "linear-gradient(to right, rgba(255,255,255,0.3), rgba(0,0,0,0) 25%, rgba(0,0,0,0.06) 60%, rgba(0,0,0,0.24))",
  "repeating-linear-gradient(90deg, #f6f1e7 0px, #f6f1e7 2px, #cbc0a9 3px, #f6f1e7 4px)",
].join(", ");

// Spine hinge: shading at the spine edge, a highlight ridge, then the groove
const SPINE_HINGE_BG =
  "linear-gradient(to right, rgba(0,0,0,0.28), rgba(0,0,0,0.05) 3%, rgba(255,255,255,0.14) 4.5%, rgba(0,0,0,0.22) 7%, rgba(0,0,0,0) 10%)";

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
  alt,
  layoutId,
  className,
}: BookCover3DProps) {
  return (
    <motion.div
      layoutId={layoutId}
      className={cn("group/book relative h-full w-full", className)}
      style={{ perspective: "1200px" }}
    >
      {/* Contact shadow beneath the book */}
      <div className="absolute inset-x-[8%] bottom-[-5%] h-[9%] rounded-[50%] bg-black/35 blur-lg transition-all duration-300 group-hover/book:bg-black/25" />

      {/* Back cover — same board as the front, in shadow behind the pages */}
      <div className="absolute inset-0 overflow-hidden rounded-[2px] rounded-r-[4px] shadow-[2px_4px_12px_rgba(0,0,0,0.35)]">
        {/* biome-ignore lint/performance/noImgElement: using proxy URL for stored cover */}
        <img
          src={src}
          alt=""
          aria-hidden
          className="h-full w-full object-cover brightness-[0.5] saturate-[0.85]"
          loading="lazy"
        />
      </div>

      {/* Page block fore-edge — a plane receding from behind the cover's
          fore-edge toward the back board, inset so the boards overhang */}
      <div
        className="absolute inset-y-[1.5%] left-[91%] w-[16%] origin-left [transform:rotateY(58deg)]"
        style={{ background: PAGE_EDGE_BG }}
      />

      {/* Front cover, hinged at the spine */}
      <div className="absolute inset-0 origin-left transition-transform duration-300 ease-out [transform:rotateY(-28deg)] group-hover/book:[transform:rotateY(-35deg)]">
        <div className="absolute inset-0 overflow-hidden rounded-[2px] rounded-r-[4px] shadow-[10px_10px_24px_-8px_rgba(0,0,0,0.5)]">
          {/* biome-ignore lint/performance/noImgElement: using proxy URL for stored cover */}
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {/* Spine hinge groove down the left edge */}
          <div
            className="absolute inset-y-0 left-0 w-full"
            style={{ background: SPINE_HINGE_BG }}
          />
          {/* Board edge catching the light at the fore-edge */}
          <div className="absolute inset-y-0 right-0 w-[2%] bg-gradient-to-l from-white/30 to-transparent" />
          {/* Subtle sheen */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/12 to-transparent" />
        </div>
      </div>
    </motion.div>
  );
}
