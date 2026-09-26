import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTrace, traceNames } from "./test-utils";
import {
  debugTrace,
  getTraceEvents,
  isTracing,
  MAX_TRACE_EVENTS,
  setTracingEnabled,
  setTracingPaused,
  subscribeTrace,
} from "./trace";

describe("debug trace store", () => {
  beforeEach(() => resetTrace());
  afterEach(() => resetTrace({ enabled: false }));

  it("records nothing while tracing is off", () => {
    setTracingEnabled(false);
    debugTrace("grid", "reflow");
    expect(getTraceEvents()).toEqual([]);
    expect(isTracing()).toBe(false);
  });

  it("records events with channel, name, and data while on", () => {
    debugTrace("url", "pushState", { to: "/dashboard?item=1" });
    const [event] = getTraceEvents();
    expect(event).toMatchObject({
      channel: "url",
      event: "pushState",
      data: { to: "/dashboard?item=1" },
    });
    expect(typeof event.t).toBe("number");
  });

  it("drops events while paused", () => {
    setTracingPaused(true);
    debugTrace("grid", "reflow");
    expect(isTracing()).toBe(false);
    setTracingPaused(false);
    debugTrace("grid", "items");
    expect(traceNames()).toEqual(["grid:items"]);
  });

  it("keeps only the most recent MAX_TRACE_EVENTS", () => {
    for (let i = 0; i < MAX_TRACE_EVENTS + 10; i++) {
      debugTrace("perf", `e${i}`);
    }
    const events = getTraceEvents();
    expect(events).toHaveLength(MAX_TRACE_EVENTS);
    expect(events[0].event).toBe("e10");
    expect(events.at(-1)?.event).toBe(`e${MAX_TRACE_EVENTS + 9}`);
  });

  it("slots a backdated event in time order", () => {
    const start = performance.now();
    debugTrace("query", "success");
    debugTrace("grid", "reflow", undefined, { at: start - 100 });
    expect(traceNames()).toEqual(["grid:reflow", "query:success"]);
  });

  it("puts a backdated event before one logged at the same instant", () => {
    const now = performance.now();
    debugTrace("dialog", "mount", undefined, { at: now });
    debugTrace("dialog", "unmount", undefined, { at: now });
    expect(traceNames()).toEqual(["dialog:unmount", "dialog:mount"]);
  });

  it("drops a backdated event older than a full window instead of a newer one", () => {
    const start = performance.now();
    for (let i = 0; i < MAX_TRACE_EVENTS; i++) debugTrace("perf", `e${i}`);
    debugTrace("grid", "ancient", undefined, { at: start - 10_000 });
    const events = getTraceEvents();
    expect(events).toHaveLength(MAX_TRACE_EVENTS);
    expect(events[0].event).toBe("e0");
    expect(events.some((event) => event.event === "ancient")).toBe(false);
  });

  it("returns a stable snapshot until something changes", () => {
    debugTrace("mark", "mark");
    const snapshot = getTraceEvents();
    expect(getTraceEvents()).toBe(snapshot);
    debugTrace("mark", "mark");
    expect(getTraceEvents()).not.toBe(snapshot);
  });

  it("batches listener notifications for a burst of events", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTrace(listener);
    debugTrace("grid", "a");
    debugTrace("grid", "b");
    debugTrace("grid", "c");
    await vi.waitFor(() => expect(listener).toHaveBeenCalled());
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
