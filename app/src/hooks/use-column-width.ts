"use client";

import { type RefObject, useLayoutEffect, useState } from "react";
import { gridColumnCount } from "@/lib/items/complete-rows";
import { coalesceFrame } from "@/lib/raf-coalesce";

// Layout effect on the client so the measured width is available before the
// first paint (no reflow flash); plain effect on the server where it's a no-op.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? () => {} : useLayoutEffect;

type UseColumnWidthOptions = {
  ref: RefObject<HTMLElement | null>;
  /** Minimum column width — the grid's `minmax(frameWidth, 1fr)` floor. */
  frameWidth: number;
  gap: number;
  /** Gate measurement until the container is mounted (post-hydration). */
  enabled: boolean;
};

/**
 * Measured width of a single masonry column, and how many columns there are.
 *
 * The grid lays columns out as `repeat(auto-fill, minmax(frameWidth, 1fr))`, so
 * the real column width is the container width divided across however many
 * columns fit — stretched by `1fr` above the `frameWidth` floor. The content
 * estimators need this actual width (not the floor) to count line wraps
 * correctly. Both are `null` until measured.
 */
export function useColumnWidth({
  ref,
  frameWidth,
  gap,
  enabled,
}: UseColumnWidthOptions): {
  columnWidth: number | null;
  columnCount: number | null;
} {
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    const measure = () => setContainerWidth(element.clientWidth);
    measure();

    // rAF-defer the measure so a resulting reflow can't retrigger the observer
    // mid-delivery (the "ResizeObserver loop … undelivered notifications" error).
    const scheduler = coalesceFrame(measure);
    const observer = new ResizeObserver(scheduler.schedule);
    observer.observe(element);
    return () => {
      scheduler.cancel();
      observer.disconnect();
    };
    // `enabled` re-runs the effect once the container mounts; frameWidth/gap
    // don't change the container width but keep the derived value below fresh.
  }, [ref, enabled]);

  if (containerWidth === null) return { columnWidth: null, columnCount: null };

  const columnCount = gridColumnCount({ containerWidth, frameWidth, gap });
  return {
    columnWidth: (containerWidth - (columnCount - 1) * gap) / columnCount,
    columnCount,
  };
}
