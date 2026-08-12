"use client";

import { type RefObject, useEffect, useLayoutEffect, useState } from "react";

// Layout effect on the client so the fade decision lands before paint; a no-op
// effect on the server avoids the SSR warning.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Whether the referenced (clipping) element's content overflows its box.
 *
 * Drives the "there's more below" fade so it shows only when content is
 * actually clipped — never over a card whose content fully fits. Re-measures on
 * size changes (density, column resize) and content changes (markdown/text,
 * late-loading fonts) via Resize + Mutation observers.
 *
 * `tolerancePx` ignores sub-pixel/rounding overflow so a card that fits to the
 * pixel doesn't flip the fade on.
 */
export function useIsOverflowing(
  ref: RefObject<HTMLElement | null>,
  tolerancePx = 4,
): boolean {
  const [overflowing, setOverflowing] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      setOverflowing(false);
      return;
    }

    const measure = () =>
      setOverflowing(element.scrollHeight - element.clientHeight > tolerancePx);
    measure();

    // Observers are optional: the synchronous measure above is enough for the
    // initial decision, and jsdom (unit tests) has no ResizeObserver.
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    resizeObserver?.observe(element);
    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(measure);
    mutationObserver?.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [ref, tolerancePx]);

  return overflowing;
}
