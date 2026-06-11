"use client";

import type { ProcessingStatus } from "@prisma/client";
import { useCallback, useEffect, useRef } from "react";
import { api } from "./api-client";
import { useInvalidateItems } from "./api-hooks";
import { createLogger } from "./logger.client";

const log = createLogger("use-processing-poll");

type StatusResponse = {
  items: Array<{
    id: string;
    processingStatus: ProcessingStatus;
    updatedAt: string;
  }>;
};

const POLL_INTERVAL_MS = 1500; // Poll every 1.5 seconds

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
  // Last updatedAt seen per item, to detect mid-processing changes
  const lastSeenUpdatedAtRef = useRef<Map<string, string>>(new Map());

  const checkStatus = useCallback(async () => {
    if (processingItemIds.length === 0) return;

    try {
      const idsParam = processingItemIds.join(",");
      const response = await api.get<StatusResponse>(
        `/api/v1/items/status?ids=${encodeURIComponent(idsParam)}`,
      );

      const lastSeen = lastSeenUpdatedAtRef.current;

      // Items that finished processing
      const finished = response.items.filter(
        (item) =>
          item.processingStatus === "completed" ||
          item.processingStatus === "failed",
      );

      // Items updated mid-processing (e.g. URL classified, analysis written).
      // The first sighting only records a baseline, so we don't refetch
      // items that haven't changed since the grid loaded them.
      const updated = response.items.filter((item) => {
        const previous = lastSeen.get(item.id);
        lastSeen.set(item.id, item.updatedAt);
        return previous !== undefined && previous !== item.updatedAt;
      });

      if (finished.length > 0 || updated.length > 0) {
        log.info(
          {
            finishedIds: finished.map((i) => i.id),
            updatedIds: updated.map((i) => i.id),
          },
          "Processing items changed, invalidating query",
        );
        invalidateItems();
      }
    } catch (error) {
      log.error({ error }, "Failed to check processing status");
    }
  }, [processingItemIds, invalidateItems]);

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
