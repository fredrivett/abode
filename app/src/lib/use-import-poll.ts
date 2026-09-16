"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export type ImportSnapshot = {
  id: string;
  source: string;
  status: "pending" | "importing" | "completed" | "failed";
  totalCount: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

const POLL_INTERVAL_MS = 1500;
// Consecutive failed polls before we give up and surface an error, rather than
// leaving the caller stuck showing "in progress" forever.
const MAX_CONSECUTIVE_FAILURES = 5;

function isTerminal(status: ImportSnapshot["status"]): boolean {
  return status === "completed" || status === "failed";
}

export type ImportPoll = {
  status: ImportSnapshot | null;
  /** True once the status endpoint has failed repeatedly — polling has stopped. */
  error: boolean;
};

/**
 * Poll a single import's status/counts until it reaches a terminal state.
 * Pass `null` to disable (no import in flight). Mirrors use-processing-poll's
 * setInterval + cleanup shape. A transient blip is ignored, but after
 * {@link MAX_CONSECUTIVE_FAILURES} straight failures it stops and reports
 * `error: true` so the caller can recover instead of hanging on an unknown
 * status forever.
 */
export function useImportPoll(
  importId: string | null,
  initial: ImportSnapshot | null = null,
): ImportPoll {
  const [status, setStatus] = useState<ImportSnapshot | null>(initial);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!importId) {
      setStatus(null);
      setError(false);
      return;
    }
    let active = true;
    // Explicit boolean: it's mutated inside the async closure below, which flow
    // analysis can't see (it would otherwise treat the guard as always-false).
    let inFlight: boolean = false;
    let failures = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    // Drop a stale snapshot from a previous import id so a new run doesn't briefly
    // read the old (possibly terminal) status — which would leave the form enabled
    // mid-import. Keep the seed when it already matches this id (no flicker).
    setStatus((prev) => (prev?.id === importId ? prev : null));
    setError(false);

    const check = async () => {
      if (inFlight) return; // no overlapping requests, so a slow poll can't be
      inFlight = true; //     overtaken and its stale result overwrite a newer one
      try {
        const data = await api.get<ImportSnapshot>(
          `/api/v1/imports/${importId}`,
        );
        if (!active) return;
        failures = 0;
        setStatus(data);
        if (isTerminal(data.status) && timer) clearInterval(timer);
      } catch {
        if (!active) return;
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          setError(true);
          if (timer) clearInterval(timer);
        }
      } finally {
        inFlight = false;
      }
    };

    void check();
    timer = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [importId]);

  return { status, error };
}
