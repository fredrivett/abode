"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 * Uses a callback ref so the observer is set up as soon as the sentinel element
 * mounts (even if it mounts after the initial render).
 *
 * @returns A ref callback to attach to the sentinel element at the bottom of the list.
 */
export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
}: UseInfiniteScrollOptions) {
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const wasIntersectingRef = useRef(false);

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    setSentinelEl(node);
  }, []);

  useEffect(() => {
    if (!sentinelEl || !hasMore || isLoading) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      return;
    }

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      const isNowIntersecting = entry.isIntersecting;
      const wasIntersecting = wasIntersectingRef.current;
      wasIntersectingRef.current = isNowIntersecting;

      if (isNowIntersecting && !wasIntersecting) {
        onLoadMore();
      }
    };

    const timer = setTimeout(() => {
      observerRef.current = new IntersectionObserver(handleIntersection, {
        root: null,
        rootMargin: "200px",
        threshold: 0,
      });
      observerRef.current.observe(sentinelEl);
    }, 50);

    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [sentinelEl, hasMore, isLoading, onLoadMore]);

  useEffect(() => {
    if (!isLoading) {
      wasIntersectingRef.current = false;
    }
  }, [isLoading]);

  return { ref: sentinelRef };
}
