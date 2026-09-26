import {
  getTraceEvents,
  type TraceData,
  type TraceEvent,
  type TraceValue,
} from "./trace";

/** Events closer together than this are likely one causal chain */
export const CHAIN_GAP_MS = 50;

function formatValue(value: TraceValue): string {
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** One-line `key=value` summary of an event's data for the timeline row. */
export function formatTraceSummary(
  data: TraceData | undefined,
  max = 140,
): string {
  if (!data) return "";
  const summary = Object.entries(data)
    // Stacks are for the expanded view, not the one-liner
    .filter(([key]) => key !== "stack")
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(" ");
  return summary.length > max ? `${summary.slice(0, max - 1)}…` : summary;
}

/** `12.345s` — event time since page load. */
export function formatTraceTime(t: number): string {
  return `${(t / 1000).toFixed(3)}s`;
}

/** `+12ms` gap from the previous shown event (empty for the first). */
export function formatTraceGap(gap: number | null): string {
  if (gap === null) return "";
  return gap >= 1000 ? `+${(gap / 1000).toFixed(1)}s` : `+${Math.round(gap)}ms`;
}

export type TraceExport = {
  capturedAt: string;
  url: string;
  build: string | null;
  userAgent: string;
  viewport: { width: number; height: number; dpr: number };
  events: readonly TraceEvent[];
};

/** Self-describing JSON blob to paste into an issue or an agent. */
export function buildTraceExport(
  events: readonly TraceEvent[] = getTraceEvents(),
): TraceExport {
  return {
    capturedAt: new Date().toISOString(),
    url: `${window.location.pathname}${window.location.search}`,
    build: process.env.NEXT_PUBLIC_BUILD_SHA ?? null,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio,
    },
    events,
  };
}
