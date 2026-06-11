"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tracks whether any part of an element is in the viewport.
 *
 * Uses a callback ref so observation starts as soon as the element mounts
 * (even if it mounts after the initial render).
 *
 * @returns A ref callback to attach to the element, the element itself, and
 * whether it's currently in the viewport.
 */
export function useInViewport<T extends Element>() {
  const [element, setElement] = useState<T | null>(null);
  const [isInViewport, setIsInViewport] = useState(false);

  const ref = useCallback((node: T | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInViewport(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, [element]);

  return { ref, element, isInViewport };
}
