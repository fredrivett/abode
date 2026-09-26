"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { setDebugFlag } from "@/lib/debug/debug-flag";
import { buildTraceExport } from "@/lib/debug/format";
import { removeHighlightLayer } from "@/lib/debug/highlight";
import { instrumentHistory } from "@/lib/debug/instrument-history";
import { instrumentPerformance } from "@/lib/debug/instrument-performance";
import { instrumentQueryCache } from "@/lib/debug/instrument-query-cache";
import {
  clearTrace,
  debugTrace,
  getTraceEvents,
  isTracingPaused,
  setTracingEnabled,
  setTracingPaused,
  subscribeTrace,
} from "@/lib/debug/trace";
import { DebugPanel } from "./debug-panel";

/**
 * A live debug session: turns tracing on, installs the global instrumentation
 * (URL writes, React Query, layout shifts, slow frames) and renders the panel.
 * Lazy-loaded by {@link DebugTools}, so none of this ships to normal sessions.
 */
export default function DebugSession() {
  const queryClient = useQueryClient();
  const events = useSyncExternalStore(
    subscribeTrace,
    getTraceEvents,
    getTraceEvents,
  );
  const paused = useSyncExternalStore(
    subscribeTrace,
    isTracingPaused,
    isTracingPaused,
  );

  useEffect(() => {
    // A fresh session always starts recording, even if the last one was paused
    setTracingPaused(false);
    setTracingEnabled(true);
    const uninstall = [
      instrumentHistory(),
      instrumentQueryCache(queryClient),
      instrumentPerformance(),
    ];
    return () => {
      for (const stop of uninstall) stop();
      setTracingEnabled(false);
      removeHighlightLayer();
    };
  }, [queryClient]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(buildTraceExport(getTraceEvents()), null, 2),
      );
      toast.success(`Copied ${getTraceEvents().length} trace events`);
    } catch {
      toast.error("Couldn't copy the trace");
    }
  };

  return (
    <DebugPanel
      events={events}
      paused={paused}
      onTogglePause={() => setTracingPaused(!paused)}
      onClear={clearTrace}
      onCopy={copy}
      onMark={() => debugTrace("mark", "mark")}
      onDisable={() => setDebugFlag(false)}
    />
  );
}
