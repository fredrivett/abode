"use client";

import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  layoutMasonry,
  type MasonryLayout,
  type MasonryPlacement,
  masonryColumns,
} from "@/lib/masonry/layout";
import { coalesceFrame } from "@/lib/raf-coalesce";

// Layout effect on the client so the first layout lands before paint (no
// flash of an empty or unpositioned grid); a no-op on the server
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? () => {} : useLayoutEffect;

export const MASONRY_TRANSITION_MS = 300;
const TRANSITION = ["transform", "width", "height", "opacity"]
  .map((property) => `${property} ${MASONRY_TRANSITION_MS}ms ease`)
  .join(", ");

export type MasonryGeometry = { columnWidth: number };

export type MasonryGridProps<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  /**
   * The item's aspect (only width:height matters). Gets the measured column
   * width, for content-sized cards whose height depends on it.
   */
  getFrame: (
    item: T,
    geometry: MasonryGeometry,
  ) => { width: number; height: number };
  renderItem: (item: T) => ReactNode;
  /** Columns are at least this wide; as many fit as the container allows */
  minColumnWidth: number;
  gap: number;
  /**
   * Animate moves and size changes (and grow-in, below). Never on the first
   * layout or a column-count change, which would cascade every card.
   */
  animate?: boolean;
  /** Grow a newly-added item in from zero height (needs `animate`) */
  shouldGrowIn?: (item: T) => boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
};

/**
 * The app's masonry grid: items in order into the shortest column, at exact
 * aspect ratios, absolutely positioned. Appending never moves items already
 * placed, and an item changing shape (or being removed, or one inserted above)
 * only moves items below it in its own column — see `layoutMasonry`.
 *
 * Renders nothing inside the container until it has measured its width (in a
 * layout effect, so before the first paint).
 */
export function MasonryGrid<T>({
  items,
  getKey,
  getFrame,
  renderItem,
  minColumnWidth,
  gap,
  animate = false,
  shouldGrowIn,
  className,
  style,
  ref,
}: MasonryGridProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => setContainerWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    // rAF-defer so a resulting reflow can't retrigger the observer mid-delivery
    const scheduler = coalesceFrame(measure);
    const observer = new ResizeObserver(scheduler.schedule);
    observer.observe(element);
    return () => {
      scheduler.cancel();
      observer.disconnect();
    };
  }, []);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      // Pass through a React 19 callback ref's cleanup
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    },
    [ref],
  );

  const prefersReducedMotion = usePrefersReducedMotion();
  const canAnimate = animate && !prefersReducedMotion;

  // The last layout that reached the screen: frames keep their columns across
  // layouts, and animation only runs relative to a committed layout
  const committedRef = useRef<MasonryLayout | null>(null);

  let layout: MasonryLayout | null = null;
  let transition: string | undefined;
  if (containerWidth !== null) {
    const { columnCount, columnWidth } = masonryColumns({
      containerWidth,
      minColumnWidth,
      gap,
    });
    const committed = committedRef.current;
    layout = layoutMasonry({
      frames: items.map((item) => ({
        key: getKey(item),
        ...getFrame(item, { columnWidth }),
      })),
      columnCount,
      columnWidth,
      gap,
      previous: committed ?? undefined,
    });
    const geometryChanged =
      committed !== null &&
      (committed.columnCount !== layout.columnCount ||
        committed.placements[0]?.width !== layout.placements[0]?.width);
    transition =
      canAnimate && committed !== null && !geometryChanged
        ? TRANSITION
        : undefined;
  }

  useIsomorphicLayoutEffect(() => {
    if (layout) committedRef.current = layout;
  });

  const committedKeys = committedRef.current?.columns;

  return (
    <div
      ref={setRefs}
      className={className}
      style={{ position: "relative", height: layout?.height ?? 0, ...style }}
    >
      {layout?.placements.map((placement, index) => {
        const item = items[index];
        const isNew =
          committedKeys !== undefined && !committedKeys.has(placement.key);
        return (
          <MasonryCell
            key={placement.key}
            placement={placement}
            transition={transition}
            growIn={
              transition !== undefined &&
              isNew &&
              (shouldGrowIn?.(item) ?? false)
            }
          >
            {renderItem(item)}
          </MasonryCell>
        );
      })}
    </div>
  );
}

function MasonryCell({
  placement,
  transition,
  growIn,
  children,
}: {
  placement: MasonryPlacement;
  transition: string | undefined;
  /** Only read on mount: start collapsed and grow to the placement height */
  growIn: boolean;
  children: ReactNode;
}) {
  const [growing, setGrowing] = useState(growIn);
  const [expanded, setExpanded] = useState(!growIn);

  useEffect(() => {
    if (!growing) return;
    // Expand on the next frame so the collapsed state paints first and the
    // height transitions from zero
    const raf = requestAnimationFrame(() => setExpanded(true));
    const done = setTimeout(
      () => setGrowing(false),
      MASONRY_TRANSITION_MS + 60,
    );
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [growing]);

  return (
    <div
      data-grid-item={placement.key}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: placement.width,
        height: expanded ? placement.height : 0,
        opacity: expanded ? 1 : 0,
        transform: `translate3d(${placement.x}px, ${placement.y}px, 0)`,
        transition,
        // Clip while growing: the content is pinned at its full height below
        overflow: growing ? "hidden" : undefined,
      }}
    >
      <div style={{ height: growing ? placement.height : "100%" }}>
        {children}
      </div>
    </div>
  );
}
