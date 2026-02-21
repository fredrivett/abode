"use client";

import { useEffect, useRef } from "react";

type UseInfiniteScrollOptions = {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
};

/**
 * Triggers a callback when a sentinel element scrolls into view, for loading
 * more content.
 *
 * Uses IntersectionObserver with a 200px root margin. Only fires on the rising
 * edge (not intersecting -> intersecting) to prevent duplicate loads.
 *
 * @returns A ref to attach to the sentinel element at the bottom of the list.
 */
export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const wasIntersectingRef = useRef(false);

  useEffect(() => {
    const element = sentinelRef.current;

    if (!element || !hasMore || isLoading) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      return;
    }

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      const isNowIntersecting = entry.isIntersecting;
      const wasIntersecting = wasIntersectingRef.current;
      wasIntersectingRef.current = isNowIntersecting;

      // Only fire on rising edge: NOT intersecting → intersecting
      if (isNowIntersecting && !wasIntersecting) {
        onLoadMore();
      }
    };

    // Small delay before reconnecting to let new content render
    const timer = setTimeout(() => {
      observerRef.current = new IntersectionObserver(handleIntersection, {
        root: null,
        rootMargin: "200px",
        threshold: 0,
      });
      observerRef.current.observe(element);
    }, 50);

    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [hasMore, isLoading, onLoadMore]);

  // Reset intersection tracking when loading completes
  useEffect(() => {
    if (!isLoading) {
      wasIntersectingRef.current = false;
    }
  }, [isLoading]);

  return { ref: sentinelRef };
}
