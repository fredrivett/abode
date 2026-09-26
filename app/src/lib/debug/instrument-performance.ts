import { flashRects, type HighlightRect } from "./highlight";
import { debugTrace, type TraceData } from "./trace";

/** Frames longer than this are worth a timeline entry (LoAF's own floor is 50ms). */
export const SLOW_FRAME_MS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toRect(value: unknown): HighlightRect | null {
  if (!isRecord(value)) return null;
  const { x, y, width, height } = value;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return null;
  }
  return { x, y, width, height };
}

/**
 * Human-readable handle for a DOM node: its grid item id if it's inside a
 * card, else tag + first classes.
 */
export function describeNode(node: unknown): string {
  if (!(node instanceof Element)) return "(detached)";
  const gridItem = node.closest("[data-grid-item]");
  if (gridItem) return `grid-item:${gridItem.getAttribute("data-grid-item")}`;
  const dialog = node.closest("[role=dialog]");
  const classes = Array.from(node.classList).slice(0, 3).join(".");
  const label = `${node.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
  return dialog ? `dialog > ${label}` : label;
}

/**
 * Layout-shift entry → timeline payload. Note CLS only counts shifts of the
 * layout box: transform-driven motion (the masonry engine's translateY) is
 * invisible here, which is why the grid has its own observer.
 */
export function describeLayoutShift(entry: unknown): {
  data: TraceData;
  rects: HighlightRect[];
} | null {
  if (!isRecord(entry) || typeof entry.value !== "number") return null;
  if (entry.hadRecentInput === true) return null;
  const sources = Array.isArray(entry.sources) ? entry.sources : [];
  const rects: HighlightRect[] = [];
  const nodes: string[] = [];
  for (const source of sources) {
    if (!isRecord(source)) continue;
    // The debug panel's own layout isn't the app's jank
    if (
      source.node instanceof Element &&
      source.node.closest("[data-debug-panel]")
    ) {
      continue;
    }
    nodes.push(describeNode(source.node));
    const rect = toRect(source.currentRect);
    if (rect) rects.push(rect);
  }
  if (sources.length > 0 && nodes.length === 0) return null;
  return {
    data: { score: Math.round(entry.value * 10000) / 10000, nodes },
    rects,
  };
}

/** Long-animation-frame entry → timeline payload (with its heaviest scripts). */
export function describeLongFrame(entry: unknown): TraceData | null {
  if (!isRecord(entry) || typeof entry.duration !== "number") return null;
  if (entry.duration < SLOW_FRAME_MS) return null;
  const scripts = Array.isArray(entry.scripts) ? entry.scripts : [];
  const top = scripts
    .filter(isRecord)
    .sort(
      (a, b) =>
        (typeof b.duration === "number" ? b.duration : 0) -
        (typeof a.duration === "number" ? a.duration : 0),
    )
    .slice(0, 3)
    .map((script) => {
      const invoker = typeof script.invoker === "string" ? script.invoker : "?";
      const duration =
        typeof script.duration === "number" ? Math.round(script.duration) : 0;
      return `${invoker} (${duration}ms)`;
    });
  const data: TraceData = { duration: Math.round(entry.duration) };
  if (typeof entry.blockingDuration === "number") {
    data.blocking = Math.round(entry.blockingDuration);
  }
  if (top.length) data.scripts = top;
  return data;
}

function observe(type: string, onEntry: (entry: PerformanceEntry) => void) {
  const supported =
    typeof PerformanceObserver !== "undefined" &&
    PerformanceObserver.supportedEntryTypes?.includes(type);
  if (!supported) return () => {};
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) onEntry(entry);
  });
  observer.observe({ type, buffered: false });
  return () => observer.disconnect();
}

/**
 * Layout shifts (flashed red on screen) and slow frames onto the timeline.
 * Both are Chromium-only; other browsers skip silently.
 */
export function instrumentPerformance(): () => void {
  const stopShifts = observe("layout-shift", (entry) => {
    const described = describeLayoutShift(entry);
    if (!described) return;
    debugTrace("layout", "layout-shift", described.data);
    flashRects(described.rects, "shift");
  });
  const stopFrames = observe("long-animation-frame", (entry) => {
    const data = describeLongFrame(entry);
    if (data) debugTrace("perf", "slow-frame", data);
  });
  return () => {
    stopShifts();
    stopFrames();
  };
}
