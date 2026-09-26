"use client";

import { useEffect, useRef } from "react";
import {
  debugTrace,
  isTracing,
  type TraceChannel,
  type TraceData,
} from "./trace";
import { useIsTracing } from "./use-tracing";

type WatchedValue = string | number | boolean | null | undefined;

/** Keys whose value differs between two watched-value maps. */
export function changedKeys(
  prev: Record<string, WatchedValue>,
  next: Record<string, WatchedValue>,
): string[] {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  return [...keys].filter((key) => !Object.is(prev[key], next[key]));
}

function toTraceData(values: Record<string, WatchedValue>): TraceData {
  const data: TraceData = {};
  for (const [key, value] of Object.entries(values)) {
    data[key] = value === undefined ? null : value;
  }
  return data;
}

/**
 * Put a component's mount, unmount, and changes to `watch` on the debug
 * timeline — for catching remounts (mount→unmount→mount of the same thing) and
 * seeing which input flipped right before one. Watched values must be
 * primitives; derive them (ids, booleans) rather than passing objects.
 *
 * If tracing starts after the component mounted, it logs `:present` instead,
 * so the timeline still knows the component was there.
 */
export function useDebugLifecycle({
  name,
  channel,
  watch = {},
}: {
  name: string;
  channel: TraceChannel;
  watch?: Record<string, WatchedValue>;
}): void {
  const prevRef = useRef<Record<string, WatchedValue> | null>(null);
  const watchRef = useRef(watch);
  watchRef.current = watch;
  const pendingUnmountRef = useRef(false);
  const tracing = useIsTracing();
  // Whether the timeline has this instance's mount/present entry yet
  const loggedRef = useRef(false);

  // Mount/unmount only (name/channel are constant per call site). Dev Strict
  // Mode re-runs effects on the same instance within the same task, which
  // would read as exactly the mount→unmount→mount we're hunting — so defer the
  // unmount a microtask and drop the pair if the effect re-runs first. A real
  // remount is a new instance (fresh refs) and still logs both.
  useEffect(() => {
    if (pendingUnmountRef.current) {
      pendingUnmountRef.current = false;
      return scheduleUnmount;
    }
    if (isTracing()) {
      debugTrace(channel, `${name}:mount`, toTraceData(watchRef.current));
      loggedRef.current = true;
    }
    return scheduleUnmount;

    function scheduleUnmount() {
      pendingUnmountRef.current = true;
      const at = performance.now();
      queueMicrotask(() => {
        if (!pendingUnmountRef.current) return;
        pendingUnmountRef.current = false;
        // Backdated so it sorts before a replacement instance's mount
        debugTrace(channel, `${name}:unmount`, undefined, { at });
      });
    }
  }, [channel, name]);

  useEffect(() => {
    if (!tracing) {
      // The hook reads false during hydration even while recording, so check
      // the store before forgetting the mount entry
      if (!isTracing()) loggedRef.current = false;
      return;
    }
    if (loggedRef.current) return;
    loggedRef.current = true;
    debugTrace(channel, `${name}:present`, toTraceData(watchRef.current));
  }, [tracing, channel, name]);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = watch;
    // Tracing off: just keep the baseline current, skip the diff
    if (prev === null || !tracing) return;
    const changed = changedKeys(prev, watch);
    if (changed.length === 0) return;
    const data: TraceData = {};
    for (const key of changed) {
      data[key] = `${String(prev[key])} → ${String(watch[key])}`;
    }
    debugTrace(channel, `${name}:change`, data);
  });
}
