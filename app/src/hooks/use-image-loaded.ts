"use client";

import { useCallback, useState } from "react";

/**
 * Track whether an `<img>` has loaded, for fading a placeholder out on load.
 * Spread `imgProps` onto the image. The ref callback handles the already-cached
 * case where `onLoad` never fires. For a source that changes after mount, remount
 * the image (e.g. `key={src}`) to reset.
 */
export function useImageLoaded() {
  const [loaded, setLoaded] = useState(false);

  const ref = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  const onLoad = useCallback(() => setLoaded(true), []);

  return { loaded, imgProps: { ref, onLoad } };
}
