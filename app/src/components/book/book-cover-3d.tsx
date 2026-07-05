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

// Page fore-edge striations (thin cream lines) used for the right/bottom edges.
const PAGE_EDGE_BG =
  "repeating-linear-gradient(90deg, #f4f0e8 0px, #f4f0e8 1px, #d8d0c0 2px, #f4f0e8 3px)";

/**
 * A tasteful faux-3D book: cover front face + page fore-edges + contact shadow,
 * slightly rotated with a stronger rotation on hover.
 *
 * The rotation lives on an inner layer so it never conflicts with the framer
 * layout-morph transform applied to the `layoutId` element — that lets the same
 * book "grow" from a grid tile into the detail view.
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
      style={{ perspective: "1600px" }}
    >
      {/* Contact shadow beneath the book */}
      <div className="absolute inset-x-[8%] bottom-[-5%] h-[9%] rounded-[50%] bg-black/35 blur-lg transition-all duration-300 group-hover/book:bottom-[-7%] group-hover/book:bg-black/25" />

      {/* Rotated book body */}
      <div className="relative h-full w-full transition-transform duration-300 ease-out [transform-style:preserve-3d] [transform:rotateX(1deg)_rotateY(-18deg)] group-hover/book:[transform:rotateX(1deg)_rotateY(-27deg)]">
        {/* Right fore-edge (pages) */}
        <div
          className="absolute top-[1%] right-0 h-[98%] w-[4%] origin-right [transform:rotateY(90deg)]"
          style={{ background: PAGE_EDGE_BG }}
        />
        {/* Bottom fore-edge (pages) */}
        <div
          className="absolute bottom-0 left-[1%] h-[4%] w-[98%] origin-bottom [transform:rotateX(-90deg)]"
          style={{ background: PAGE_EDGE_BG }}
        />

        {/* Front cover */}
        <div className="absolute inset-0 overflow-hidden rounded-[2px] rounded-r-[3px] shadow-[0_12px_32px_-10px_rgba(0,0,0,0.55)]">
          {/* biome-ignore lint/performance/noImgElement: using proxy URL for stored cover */}
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {/* Spine crease down the left edge */}
          <div className="absolute inset-y-0 left-0 w-[8%] bg-gradient-to-r from-black/30 via-black/8 to-transparent" />
          {/* Subtle sheen */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/12 to-transparent" />
        </div>
      </div>
    </motion.div>
  );
}
