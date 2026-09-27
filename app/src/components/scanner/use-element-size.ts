"use client";

import { type RefObject, useEffect, useState } from "react";
import type { Size } from "@/lib/scanner/geometry";

/** Tracks an element's content-box size (null until first measured) */
export function useElementSize(
  ref: RefObject<HTMLElement | null>,
): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
