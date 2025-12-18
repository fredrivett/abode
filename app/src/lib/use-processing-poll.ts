"use client";

import type { ProcessingStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { api } from "./api-client";
import { createLogger } from "./logger.client";

const log = createLogger("use-processing-poll");

type StatusResponse = {
  items: Array<{
    id: string;
    processingStatus: ProcessingStatus;
  }>;
};

const POLL_INTERVAL_MS = 1500; // Poll every 1.5 seconds

/**
 * Hook that polls the server to check if processing items have completed.
 * When any item transitions from "processing" to another status, triggers a page refresh.
 *
 * @param processingItemIds - Array of item IDs that are currently in "processing" status
 */
export function useProcessingPoll(processingItemIds: string[]) {
  const router = useRouter();
  const previousIdsRef = useRef<Set<string>>(new Set());

  const checkStatus = useCallback(async () => {
    if (processingItemIds.length === 0) return;

    try {
      const idsParam = processingItemIds.join(",");
      const response = await api.get<StatusResponse>(
        `/api/v1/items/status?ids=${encodeURIComponent(idsParam)}`,
      );

      // Check if any items have finished processing
      const completedOrFailed = response.items.filter(
        (item) =>
          item.processingStatus === "completed" ||
          item.processingStatus === "failed",
      );

      if (completedOrFailed.length > 0) {
        log.info(
          { completedIds: completedOrFailed.map((i) => i.id) },
          "Items finished processing, refreshing",
        );
        router.refresh();
      }
    } catch (error) {
      log.error({ error }, "Failed to check processing status");
    }
  }, [processingItemIds, router]);

  useEffect(() => {
    // Don't poll if no processing items
    if (processingItemIds.length === 0) {
      previousIdsRef.current = new Set();
      return;
    }

    // Track previous IDs to avoid unnecessary refreshes
    const currentIds = new Set(processingItemIds);
    previousIdsRef.current = currentIds;

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
