"use client";

import { useEffect, useState } from "react";
import type { Size } from "@/lib/scanner/geometry";

/**
 * Tracks an element's content-box size (null until first measured). Returns a
 * callback ref, so the observer follows the element across remounts (e.g. a
 * view that's unmounted and shown again).
 */
export function useElementSize<T extends HTMLElement>(): {
  ref: (element: T | null) => void;
  element: T | null;
  size: Size | null;
} {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return { ref: setElement, element, size };
}
