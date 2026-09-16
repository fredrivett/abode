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

function isTerminal(status: ImportSnapshot["status"]): boolean {
  return status === "completed" || status === "failed";
}

/**
 * Poll a single import's status/counts until it reaches a terminal state.
 * Pass `null` to disable (no import in flight). Mirrors use-processing-poll's
 * setInterval + cleanup shape; transient fetch errors are ignored so a blip
 * doesn't stop the poll.
 */
export function useImportPoll(
  importId: string | null,
  initial: ImportSnapshot | null = null,
): ImportSnapshot | null {
  const [status, setStatus] = useState<ImportSnapshot | null>(initial);

  useEffect(() => {
    if (!importId) {
      setStatus(null);
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    const check = async () => {
      try {
        const data = await api.get<ImportSnapshot>(
          `/api/v1/imports/${importId}`,
        );
        if (!active) return;
        setStatus(data);
        if (isTerminal(data.status) && timer) clearInterval(timer);
      } catch {
        // transient — keep polling
      }
    };

    void check();
    timer = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [importId]);

  return status;
}
