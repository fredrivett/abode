import {
  clearTrace,
  getTraceEvents,
  setTracingEnabled,
  setTracingPaused,
} from "./trace";

/** Fresh, recording trace store for a test. */
export function resetTrace({ enabled = true } = {}): void {
  setTracingPaused(false);
  setTracingEnabled(enabled);
  clearTrace();
}

/** Recorded events as `channel:event` strings, for compact assertions. */
export function traceNames(): string[] {
  return getTraceEvents().map((event) => `${event.channel}:${event.event}`);
}
