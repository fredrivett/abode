import type { QueryCacheNotifyEvent, QueryClient } from "@tanstack/react-query";
import { debugTrace, type TraceData } from "./trace";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Compact shape of a query's data for the timeline — enough to see *that* the
 * list changed (page/item counts), not the payload itself.
 */
export function summarizeQueryData(data: unknown): TraceData {
  if (Array.isArray(data)) return { length: data.length };
  if (!isRecord(data)) return { type: data === null ? "null" : typeof data };
  const pages = data.pages;
  if (Array.isArray(pages)) {
    const items = pages.reduce<number>(
      (sum, page) =>
        sum +
        (isRecord(page) && Array.isArray(page.items) ? page.items.length : 0),
      0,
    );
    return { pages: pages.length, items };
  }
  if (Array.isArray(data.items)) return { items: data.items.length };
  if (typeof data.id === "string") return { id: data.id };
  return { keys: Object.keys(data).slice(0, 8) };
}

/** Map a cache event to a timeline entry, or null for ones not worth showing. */
export function describeQueryEvent(
  event: QueryCacheNotifyEvent,
): { event: string; data: TraceData } | null {
  const queryKey = JSON.stringify(event.query.queryKey);
  if (event.type === "removed") {
    return { event: "removed", data: { queryKey } };
  }
  if (event.type !== "updated") return null;
  const { action } = event;
  switch (action.type) {
    case "fetch": {
      const direction = action.meta?.fetchMore?.direction;
      return {
        event: direction ? `fetch:${direction}` : "fetch",
        data: {
          queryKey,
          observers: event.query.getObserversCount(),
        },
      };
    }
    case "success":
      return {
        // `manual` = setQueryData (optimistic/cache patch), not a network fetch
        event: action.manual ? "setData" : "success",
        data: { queryKey, ...summarizeQueryData(action.data) },
      };
    case "error":
      return {
        event: "error",
        data: {
          queryKey,
          message:
            action.error instanceof Error
              ? action.error.message
              : String(action.error),
        },
      };
    case "invalidate":
      return { event: "invalidate", data: { queryKey } };
    default:
      return null;
  }
}

/** Put every React Query fetch/invalidation/data change on the timeline. */
export function instrumentQueryCache(queryClient: QueryClient): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    const described = describeQueryEvent(event);
    if (described) debugTrace("query", described.event, described.data);
  });
}
