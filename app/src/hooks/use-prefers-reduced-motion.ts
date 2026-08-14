"use client";

import { useEffect, useState } from "react";

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
    // Guard matchMedia and fall back to the deprecated addListener/
    // removeListener so this degrades gracefully on Safari < 14 (mirrors
    // theme.ts) instead of throwing on mount and crashing the grid.
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mediaQuery) return;

    const update = () => setReduced(mediaQuery.matches);
    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(update);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", update);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(update);
      }
    };
  }, []);

  return reduced;
}
