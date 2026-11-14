"use client";

import type { ProcessingStatus } from "@prisma/client";
import { useEffect, useRef } from "react";
import { api } from "./api-client";
import { useRefreshCachedItems } from "./api-hooks";
import { createLogger } from "./logger.client";
import { chunk, MAX_ITEM_IDS_PER_REQUEST } from "./pagination";
import { useInvalidateFilterOptions } from "./search/use-filter-options";

const log = createLogger("use-processing-poll");

type StatusResponse = {
  items: Array<{
    id: string;
    processingStatus: ProcessingStatus;
    updatedAt: string;
  }>;
};

/** Fastest an item is re-polled: while it's still changing */
const MIN_POLL_INTERVAL_MS = 1500;
/** Slowest: an item that has gone quiet (e.g. a run that died mid-processing) */
const MAX_POLL_INTERVAL_MS = 60_000;
/** Gives the background task time to start before an item's first poll */
const FIRST_POLL_DELAY_MS = 1000;
/**
 * When a finished item is checked again: long enough for the list refetch it
 * triggered to land, so a re-report doesn't cancel that refetch mid-flight
 */
const FINISHED_RECHECK_MS = 10_000;

/**
 * How long to wait before polling an item again: a tenth of the time it has
 * gone without changing, between {@link MIN_POLL_INTERVAL_MS} and
 * {@link MAX_POLL_INTERVAL_MS}. A fresh save is polled fast; one that has been
 * stuck for minutes backs off to once a minute.
 */
export function pollDelayMs(quietMs: number): number {
  return Math.min(
    MAX_POLL_INTERVAL_MS,
    Math.max(MIN_POLL_INTERVAL_MS, quietMs / 10),
  );
}

type PollItemStatus = StatusResponse["items"][number];

function isFinished(item: PollItemStatus) {
  return (
    item.processingStatus === "completed" || item.processingStatus === "failed"
  );
}

/**
 * Given the latest status for the polled items and the last-seen `updatedAt`
 * per item, work out which items finished and which changed mid-processing.
 * Mutates `lastSeen`, recording the newest `updatedAt` for each item.
 *
 * The first sighting of a processing item only records a baseline (never
 * counted as "updated"), so we don't refetch items that haven't changed since
 * the grid loaded them. A finished item is reported once: polled again with
 * the same `updatedAt` (its card is still refreshing) it isn't news.
 */
export function detectProcessingChanges(
  items: PollItemStatus[],
  lastSeen: Map<string, string>,
): {
  finished: PollItemStatus[];
  updated: PollItemStatus[];
  changed: boolean;
} {
  const finished: PollItemStatus[] = [];
  const updated: PollItemStatus[] = [];
  for (const item of items) {
    const previous = lastSeen.get(item.id);
    lastSeen.set(item.id, item.updatedAt);
    if (previous === item.updatedAt) continue;
    if (isFinished(item)) finished.push(item);
    else if (previous !== undefined) updated.push(item);
  }

  return {
    finished,
    updated,
    changed: finished.length > 0 || updated.length > 0,
  };
}

type PollSchedule = {
  /** When this tab last saw the item change (or first saw it) */
  changedAt: number;
  /** When the item is next due a poll */
  dueAt: number;
};

/**
 * Hook that polls the server for progress on processing items.
 * Refreshes an item in the cache when it finishes (completed/failed) or is
 * updated mid-processing (e.g. a URL is classified and rich data is saved),
 * so the grid can show the rich card as soon as the data exists. Only the
 * changed items are fetched, never every loaded page.
 *
 * Each item backs off on its own ({@link pollDelayMs}), ids go out in batches
 * the status endpoint accepts, one poll runs at a time, and a hidden tab
 * doesn't poll at all (overdue items are checked as soon as it's visible).
 *
 * @param processingItemIds - Array of item IDs that are currently in "processing" status
 */
export function useProcessingPoll(processingItemIds: string[]) {
  const refreshCachedItems = useRefreshCachedItems();
  const invalidateFilterOptions = useInvalidateFilterOptions();
  // Read by the poll loop, so a changed set doesn't restart it (and its backoff)
  const idsRef = useRef(processingItemIds);
  // Reschedules the running loop; a no-op while none is running
  const wakeRef = useRef(() => {});
  const hasProcessingItems = processingItemIds.length > 0;

  useEffect(() => {
    idsRef.current = processingItemIds;
    wakeRef.current();
  }, [processingItemIds]);

  useEffect(() => {
    if (!hasProcessingItems) return;

    // Last updatedAt seen per item, to detect mid-processing changes
    const lastSeen = new Map<string, string>();
    const schedules = new Map<string, PollSchedule>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let disposed = false;

    const wake = () => {
      clearTimeout(timer);
      if (disposed || inFlight || document.hidden) return;
      const now = Date.now();
      const ids = new Set(idsRef.current);
      // Forget items that are no longer processing
      for (const id of schedules.keys()) {
        if (!ids.has(id)) {
          schedules.delete(id);
          lastSeen.delete(id);
        }
      }
      let nextDueAt = Number.POSITIVE_INFINITY;
      for (const id of ids) {
        let schedule = schedules.get(id);
        if (!schedule) {
          schedule = { changedAt: now, dueAt: now + FIRST_POLL_DELAY_MS };
          schedules.set(id, schedule);
        }
        nextDueAt = Math.min(nextDueAt, schedule.dueAt);
      }
      if (nextDueAt === Number.POSITIVE_INFINITY) return;
      timer = setTimeout(poll, Math.max(0, nextDueAt - now));
    };

    const poll = async () => {
      // Items due within one fast interval come along, so items first seen at
      // different moments (pages loaded one by one) fall into shared batches
      const batchUntil = Date.now() + MIN_POLL_INTERVAL_MS;
      const dueIds = idsRef.current.filter(
        (id) => (schedules.get(id)?.dueAt ?? 0) <= batchUntil,
      );
      inFlight = true;
      try {
        // Batches settle independently: one failing doesn't drop the others
        const results = await Promise.allSettled(
          chunk(dueIds, MAX_ITEM_IDS_PER_REQUEST).map((ids) =>
            api.get<StatusResponse>(
              `/api/v1/items/status?ids=${encodeURIComponent(ids.join(","))}`,
            ),
          ),
        );
        const items: PollItemStatus[] = [];
        for (const result of results) {
          if (result.status === "fulfilled") items.push(...result.value.items);
          else {
            log.error(
              { error: result.reason },
              "Failed to check processing status",
            );
          }
        }
        if (disposed) return;

        const { finished, updated, changed } = detectProcessingChanges(
          items,
          lastSeen,
        );

        let refreshed = true;
        if (changed) {
          const changedIds = [...finished, ...updated].map((i) => i.id);
          log.info(
            {
              finishedIds: finished.map((i) => i.id),
              updatedIds: updated.map((i) => i.id),
            },
            "Processing items changed, refreshing them",
          );
          refreshed = await refreshCachedItems(changedIds);
          // Forget what was seen, so the next poll reports them again
          if (!refreshed) for (const id of changedIds) lastSeen.set(id, "");
          // Classification/analysis can introduce a new kind, source, tag, etc,
          // so refresh the filter options that power the search autocomplete
          invalidateFilterOptions();
          if (disposed) return;
        }

        const now = Date.now();
        for (const item of updated) {
          const schedule = schedules.get(item.id);
          if (schedule) schedule.changedAt = now;
        }
        for (const id of dueIds) {
          const schedule = schedules.get(id);
          if (schedule) {
            schedule.dueAt = now + pollDelayMs(now - schedule.changedAt);
          }
        }
        // It leaves the set once its card shows it finished. If the list
        // still shows it processing at the recheck (the fetch failed), it's
        // reported again, as a first sighting
        for (const item of finished) {
          const schedule = schedules.get(item.id);
          if (schedule) schedule.dueAt = now + FINISHED_RECHECK_MS;
          lastSeen.delete(item.id);
        }
      } finally {
        inFlight = false;
        wake();
      }
    };

    wakeRef.current = wake;
    document.addEventListener("visibilitychange", wake);
    wake();

    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      wakeRef.current = () => {};
    };
  }, [hasProcessingItems, refreshCachedItems, invalidateFilterOptions]);
}
