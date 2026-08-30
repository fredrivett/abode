"use client";

import { useEffect, useState } from "react";
import { subscribeMediaQuery } from "@/lib/media-query";

/**
 * Whether the user has requested reduced motion.
 *
 * Starts false (SSR-safe) and resolves on mount, so motion-gated effects treat
 * the first paint as "motion allowed" and only disable once the media query
 * confirms the preference.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // Guard matchMedia so this degrades gracefully on browsers without it
    // instead of throwing on mount and crashing the grid.
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mediaQuery) return;

    const update = () => setReduced(mediaQuery.matches);
    update();

    return subscribeMediaQuery(mediaQuery, update);
  }, []);

  return reduced;
}
