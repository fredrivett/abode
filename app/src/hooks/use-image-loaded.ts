"use client";

import { useCallback, useState } from "react";

/**
 * Track whether the image currently at `src` has loaded, for fading a
 * placeholder out on load. Spread `imgProps` onto the `<img>`. Resets whenever
 * `src` changes — including when it returns to a previously-loaded URL — so a
 * stale load never hides the placeholder before the current image has painted.
 * The ref handles the already-cached case where `onLoad` never fires.
 */
export function useImageLoaded(src: string | null | undefined) {
  const [trackedSrc, setTrackedSrc] = useState(src);
  const [loaded, setLoaded] = useState(false);

  // Adjust state during render when the source changes (React's recommended
  // pattern), so the reset is applied to the current image, not a stale one.
  if (src !== trackedSrc) {
    setTrackedSrc(src);
    setLoaded(false);
  }

  const onLoad = useCallback(() => setLoaded(true), []);
  const ref = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  return { loaded: !!src && loaded, imgProps: { ref, onLoad } };
}
