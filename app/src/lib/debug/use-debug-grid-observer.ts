"use client";

import { useEffect, useState } from "react";
import { createLogger } from "@/lib/logger.client";
import { checkGridHealth } from "./grid-health";
import {
  diffGridSnapshots,
  type GridSnapshot,
  snapshotGrid,
} from "./grid-layout-diff";
import { flashRects } from "./highlight";
import { debugTrace, isTracing } from "./trace";
import { useIsTracing } from "./use-tracing";

/** Wait this long after the last style mutation — past the 300ms reflow transitions — before measuring */
const SETTLE_MS = 400;
const SAMPLE_SIZE = 8;
// The health check also runs in local dev with tracing off, warning in the console
const IS_DEV = process.env.NODE_ENV === "development";
const log = createLogger("debug/grid-health");

/** Report settled cells a user can't see, and text cards that don't fit their frame */
function reportGridHealth(root: HTMLElement) {
  const issues = checkGridHealth(root);
  if (issues.length === 0) return;
  if (IS_DEV) log.warn({ issues }, "Grid health issues");
  if (!isTracing()) return;
  debugTrace("grid", "health", {
    count: issues.length,
    sample: issues
      .slice(0, SAMPLE_SIZE)
      .map(({ id, issue, frame, natural }) =>
        natural === undefined
          ? `${id} ${issue}`
          : `${id} ${issue} frame ${Math.round(frame)} content ${Math.round(natural)}`,
      ),
  });
  flashRects(
    issues.flatMap(({ id }) => {
      const cell = root.querySelector(`[data-grid-item="${CSS.escape(id)}"]`);
      return cell ? [cell.getBoundingClientRect()] : [];
    }),
    "issue",
  );
}

/**
 * Trace masonry reflows: after each burst of grid DOM/style mutations settles,
 * diff every frame's position against the last settled layout and log what
 * moved, flashing visible movers blue. The masonry engine positions frames
 * with transforms, which the browser's layout-shift API doesn't count — this is
 * the only way to see "the grid jumped". Each settle also runs the grid
 * health check (`checkGridHealth`).
 */
export function useDebugGridObserver(): (node: HTMLElement | null) => void {
  const tracing = useIsTracing();
  // State (not a ref) so the observer attaches when the grid mounts later —
  // it renders only after hydration and only when there are items
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if ((!tracing && !IS_DEV) || !root) return;

    let prev: GridSnapshot = snapshotGrid(root);
    let burstStart: number | null = null;
    let mutations = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const settle = () => {
      timer = null;
      const next = snapshotGrid(root);
      reportGridHealth(root);
      // Paused: keep the baseline current (so resuming doesn't report every
      // move made meanwhile) but don't log or flash
      if (!isTracing()) {
        prev = next;
        burstStart = null;
        mutations = 0;
        return;
      }
      const viewport = {
        top: window.scrollY,
        bottom: window.scrollY + window.innerHeight,
      };
      const diff = diffGridSnapshots({ prev, next, viewport });
      prev = next;
      const visibleMoves = diff.moved.filter((move) => move.visible);
      if (diff.moved.length || diff.added.length || diff.removed.length) {
        const maxDy = diff.moved.reduce(
          (max, move) => Math.max(max, Math.abs(move.dy)),
          0,
        );
        const startedAt = burstStart ?? performance.now();
        debugTrace(
          "grid",
          "reflow",
          {
            settleMs: Math.round(performance.now() - startedAt),
            mutations,
            moved: diff.moved.length,
            movedVisible: visibleMoves.length,
            maxDy,
            added: diff.added.length,
            removed: diff.removed.length,
            sample: visibleMoves
              .slice(0, SAMPLE_SIZE)
              .map((move) => `${move.id} Δ${move.dx},${move.dy}`),
          },
          { at: startedAt },
        );
        flashRects(
          visibleMoves.flatMap((move) => {
            const box = next.get(move.id);
            return box
              ? [
                  {
                    x: box.x - window.scrollX,
                    y: box.y - window.scrollY,
                    width: box.width,
                    height: box.height,
                  },
                ]
              : [];
          }),
          "move",
        );
      }
      burstStart = null;
      mutations = 0;
    };

    const observer = new MutationObserver((records) => {
      if (burstStart === null) burstStart = performance.now();
      mutations += records.length;
      if (timer) clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_MS);
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributeFilter: ["style"],
    });
    // Check a grid that's already settled when tracing turns on
    timer = setTimeout(settle, SETTLE_MS);

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [root, tracing]);

  return setRoot;
}
