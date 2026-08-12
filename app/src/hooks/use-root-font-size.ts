"use client";

import { useEffect, useLayoutEffect, useState } from "react";

// Layout effect on the client so the value is right before first paint; a no-op
// effect on the server (where there's no DOM to measure).
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const DEFAULT_ROOT_PX = 16;

/**
 * The document's root font size in px — what `1rem` actually resolves to.
 *
 * `rem`-based sizing (the card font is `calc(var(--grid-font-scale) * 1rem)`,
 * tweet cards use `text-sm`/`p-4`/`size-6`) tracks the user's browser font-size
 * preference, which isn't always the 16px default. The content-height
 * estimators need the live value so their frames stay aligned with the rendered
 * typography instead of assuming 16px. Falls back to 16 for SSR/first render.
 */
export function useRootFontSize(): number {
  const [rootPx, setRootPx] = useState(DEFAULT_ROOT_PX);

  useIsomorphicLayoutEffect(() => {
    const measure = () => {
      const px = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      if (px > 0) setRootPx(px);
    };
    measure();
    // The preference can change mid-session (OS/browser accessibility settings).
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return rootPx;
}
