"use client";

import { Frame } from "@masonry-grid/react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { growInTargetPx } from "@/lib/items/grow-in";

const GROW_IN_MS = 300;

type ItemFrameProps = {
  /** Masonry aspect props (not real pixels) — also drive the settled box. */
  width: number;
  height: number;
  /** Measured column width; null until the grid has measured it. */
  columnWidth: number | null;
  /** Transition the masonry engine's transform/aspect reflow uses. */
  frameTransition?: string;
  /** True when this is a freshly-added item that should grow into the grid. */
  animateIn: boolean;
  children: ReactNode;
};

/**
 * A single masonry Frame. Freshly-added items grow in: the engine keeps the
 * width/height props at their target, so it reserves the final slot and slides
 * neighbours down (via `frameTransition`) as they do on any reflow — meanwhile
 * we animate the frame's explicit height from 0 to its settled px height, in
 * sync with that slide, clipping a fixed-height inner wrapper so the content
 * doesn't reflow while it grows. Once grown we drop the explicit height so
 * `aspect-ratio` governs again (keeping later analysis-driven aspect changes
 * animating as before).
 */
export function ItemFrame({
  width,
  height,
  columnWidth,
  frameTransition,
  animateIn,
  children,
}: ItemFrameProps) {
  const targetPx =
    columnWidth !== null ? growInTargetPx(columnWidth, width, height) : null;
  const grow = animateIn && targetPx !== null && targetPx > 0;

  // `expanded` drives height 0 → target; `settled` hands sizing back to
  // aspect-ratio once the grow finishes. Both start "done" when not growing.
  const [expanded, setExpanded] = useState(!grow);
  const [settled, setSettled] = useState(!grow);

  useEffect(() => {
    if (!grow) return;
    // Flip to the target on the next frame so the 0 → target height transitions.
    const raf = requestAnimationFrame(() => setExpanded(true));
    const done = setTimeout(() => setSettled(true), GROW_IN_MS + 60);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [grow]);

  const growing = grow && !settled;

  const frameStyle: CSSProperties = {
    aspectRatio: `${width} / ${height}`,
    transition: growing
      ? [
          frameTransition,
          `height ${GROW_IN_MS}ms ease, opacity ${GROW_IN_MS}ms ease`,
        ]
          .filter(Boolean)
          .join(", ")
      : frameTransition,
  };
  if (growing && targetPx !== null) {
    frameStyle.height = expanded ? `${targetPx}px` : 0;
    frameStyle.opacity = expanded ? 1 : 0;
    frameStyle.overflow = "hidden";
  }

  return (
    <Frame width={width} height={height} style={frameStyle}>
      <div
        className="h-full"
        // Pin the content to its full height while the frame clips it, so it
        // lays out once instead of reflowing on every animation frame.
        style={
          growing && targetPx !== null ? { height: `${targetPx}px` } : undefined
        }
      >
        {children}
      </div>
    </Frame>
  );
}
