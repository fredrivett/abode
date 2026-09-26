import { useSyncExternalStore } from "react";
import { isTracing, subscribeTrace } from "./trace";

/** Reactive {@link isTracing}, for hooks that attach observers only while tracing. */
export function useIsTracing(): boolean {
  return useSyncExternalStore(subscribeTrace, isTracing, () => false);
}
