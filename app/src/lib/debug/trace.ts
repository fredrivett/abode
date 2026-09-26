import { isDebugFlagOn } from "./debug-flag";

/**
 * In-memory event timeline for the admin debug tools.
 *
 * Instrumentation across the app calls {@link debugTrace}; while tracing is off
 * (every normal session) that's a single boolean check, so it's safe to call
 * from hot paths like grid renders. While on, events land in a bounded ring
 * buffer the debug panel renders and can export as JSON — the point being to
 * see causal chains (refetch → list changed → dialog unmounted) in one place.
 */

export const TRACE_CHANNELS = [
  "url",
  "query",
  "grid",
  "dialog",
  "layout",
  "perf",
  "mark",
] as const;

export type TraceChannel = (typeof TRACE_CHANNELS)[number];

/** JSON-safe payload so a trace can be copied out verbatim. */
export type TraceValue =
  | string
  | number
  | boolean
  | null
  | TraceValue[]
  | { [key: string]: TraceValue };

export type TraceData = Record<string, TraceValue>;

export type TraceEvent = {
  id: number;
  /** ms since page load (performance.now()) */
  t: number;
  channel: TraceChannel;
  event: string;
  data?: TraceData;
};

export const MAX_TRACE_EVENTS = 500;

// Start recording at module load when the flag is set, so events from the very
// first render (a deep-linked dialog mounting, the grid's initial reflows) are
// captured before the debug tools have loaded and confirmed admin access
let enabled = isDebugFlagOn();
let paused = false;
let nextId = 1;
let events: readonly TraceEvent[] = [];
const listeners = new Set<() => void>();
const notify = { scheduled: false };

// Batch notifications to one per frame so a burst of events (a reflow, a
// refetch) re-renders the panel once, not per event
function scheduleNotify() {
  if (notify.scheduled) return;
  notify.scheduled = true;
  const flush = () => {
    notify.scheduled = false;
    for (const listener of listeners) listener();
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(flush);
  } else {
    queueMicrotask(flush);
  }
}

/** True while tracing is on — guard any non-trivial payload building with it. */
export function isTracing(): boolean {
  return enabled && !paused;
}

/**
 * Record an event. A no-op unless tracing is on. Pass `at` (a performance.now()
 * timestamp) for an event only known after the fact — e.g. a reflow measured
 * once it settles — so it slots into the timeline where it actually began.
 */
export function debugTrace(
  channel: TraceChannel,
  event: string,
  data?: TraceData,
  options?: { at?: number },
): void {
  if (!enabled || paused) return;
  const entry: TraceEvent = {
    id: nextId++,
    t: Math.round((options?.at ?? performance.now()) * 10) / 10,
    channel,
    event,
    ...(data ? { data } : {}),
  };
  const next =
    events.length >= MAX_TRACE_EVENTS
      ? events.slice(events.length - MAX_TRACE_EVENTS + 1)
      : events.slice();
  // Insert in time order. A backdated event also goes before same-timestamp
  // ones: it happened first, it was just logged later
  const backdated = options?.at !== undefined;
  let index = next.length;
  while (
    index > 0 &&
    (next[index - 1].t > entry.t ||
      (backdated && next[index - 1].t === entry.t))
  ) {
    index--;
  }
  next.splice(index, 0, entry);
  events = next;
  scheduleNotify();
}

export function setTracingEnabled(value: boolean): void {
  if (enabled === value) return;
  enabled = value;
  scheduleNotify();
}

export function setTracingPaused(value: boolean): void {
  if (paused === value) return;
  paused = value;
  scheduleNotify();
}

export function isTracingPaused(): boolean {
  return paused;
}

export function clearTrace(): void {
  events = [];
  scheduleNotify();
}

/** Stable snapshot (a new array only when events change) for useSyncExternalStore. */
export function getTraceEvents(): readonly TraceEvent[] {
  return events;
}

export function subscribeTrace(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
