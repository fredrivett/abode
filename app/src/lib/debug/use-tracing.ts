import { useSyncExternalStore } from "react";
import { getTraceGeneration, isTracing, subscribeTrace } from "./trace";

/** Reactive {@link isTracing}, for hooks that attach observers only while tracing. */
export function useIsTracing(): boolean {
  return useSyncExternalStore(subscribeTrace, isTracing, () => false);
}

/** Reactive {@link getTraceGeneration}: changes each time the trace is cleared. */
export function useTraceGeneration(): number {
  return useSyncExternalStore(subscribeTrace, getTraceGeneration, () => 0);
}
