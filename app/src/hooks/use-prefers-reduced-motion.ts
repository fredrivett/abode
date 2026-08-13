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
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return reduced;
}
