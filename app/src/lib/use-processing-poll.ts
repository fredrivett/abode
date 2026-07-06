"use client";

import type { ProcessingStatus } from "@prisma/client";
import { useCallback, useEffect, useRef } from "react";
import { api } from "./api-client";
import { useInvalidateItems } from "./api-hooks";
import { createLogger } from "./logger.client";
import { useInvalidateFilterOptions } from "./search/use-filter-options";

const log = createLogger("use-processing-poll");

type StatusResponse = {
  items: Array<{
    id: string;
    processingStatus: ProcessingStatus;
    updatedAt: string;
  }>;
};

const POLL_INTERVAL_MS = 1500; // Poll every 1.5 seconds

type PollItemStatus = StatusResponse["items"][number];

/**
 * Given the latest status for the polled items and the last-seen `updatedAt`
 * per item, work out which items finished and which changed mid-processing.
 * Mutates `lastSeen`, recording the newest `updatedAt` for each item.
 *
 * The first sighting of an item only records a baseline (never counted as
 * "updated"), so we don't refetch items that haven't changed since the grid
 * loaded them.
 */
export function detectProcessingChanges(
  items: PollItemStatus[],
  lastSeen: Map<string, string>,
): {
  finished: PollItemStatus[];
  updated: PollItemStatus[];
  changed: boolean;
} {
  const finished = items.filter(
    (item) =>
      item.processingStatus === "completed" ||
      item.processingStatus === "failed",
  );

  const updated = items.filter((item) => {
    const previous = lastSeen.get(item.id);
    lastSeen.set(item.id, item.updatedAt);
    return previous !== undefined && previous !== item.updatedAt;
  });

  return {
    finished,
    updated,
    changed: finished.length > 0 || updated.length > 0,
  };
}

/**
 * Hook that polls the server for progress on processing items.
 * Invalidates the items query when an item finishes (completed/failed) or is
 * updated mid-processing (e.g. a URL is classified and rich data is saved),
 * so the grid can show the rich card as soon as the data exists.
 *
 * @param processingItemIds - Array of item IDs that are currently in "processing" status
 */
export function useProcessingPoll(processingItemIds: string[]) {
  const invalidateItems = useInvalidateItems();
  const invalidateFilterOptions = useInvalidateFilterOptions();
  // Last updatedAt seen per item, to detect mid-processing changes
  const lastSeenUpdatedAtRef = useRef<Map<string, string>>(new Map());

  const checkStatus = useCallback(async () => {
    if (processingItemIds.length === 0) return;

    try {
      const idsParam = processingItemIds.join(",");
      const response = await api.get<StatusResponse>(
        `/api/v1/items/status?ids=${encodeURIComponent(idsParam)}`,
      );

      const { finished, updated, changed } = detectProcessingChanges(
        response.items,
        lastSeenUpdatedAtRef.current,
      );

      if (changed) {
        log.info(
          {
            finishedIds: finished.map((i) => i.id),
            updatedIds: updated.map((i) => i.id),
          },
          "Processing items changed, invalidating query",
        );
        invalidateItems();
        // Classification/analysis can introduce a new kind, source, tag, etc,
        // so refresh the filter options that power the search autocomplete
        invalidateFilterOptions();
      }
    } catch (error) {
      log.error({ error }, "Failed to check processing status");
    }
  }, [processingItemIds, invalidateItems, invalidateFilterOptions]);

  useEffect(() => {
    // Don't poll if no processing items
    if (processingItemIds.length === 0) {
      lastSeenUpdatedAtRef.current.clear();
      return;
    }

    // Prune baselines for items that are no longer processing
    const currentIds = new Set(processingItemIds);
    for (const id of lastSeenUpdatedAtRef.current.keys()) {
      if (!currentIds.has(id)) lastSeenUpdatedAtRef.current.delete(id);
    }

    // Start polling
    const intervalId = setInterval(checkStatus, POLL_INTERVAL_MS);

    // Initial check after a short delay (give time for background task to start)
    const timeoutId = setTimeout(checkStatus, 1000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [processingItemIds, checkStatus]);
}
