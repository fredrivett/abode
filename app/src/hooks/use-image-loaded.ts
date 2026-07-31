"use client";

import { useCallback, useState } from "react";

/**
 * Track whether the image currently at `src` has loaded, for fading a
 * placeholder out on load. Spread `imgProps` onto the `<img>`. Resets
 * automatically when `src` changes — `loaded` is derived from which src finished
 * loading, so the placeholder shows again for a new image with no effect needed.
 * The ref handles the already-cached case where `onLoad` never fires.
 */
export function useImageLoaded(src: string | null | undefined) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const markLoaded = useCallback(() => {
    if (src) setLoadedSrc(src);
  }, [src]);

  const ref = useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete && node.naturalWidth > 0) markLoaded();
    },
    [markLoaded],
  );

  return {
    loaded: !!src && loadedSrc === src,
    imgProps: { ref, onLoad: markLoaded },
  };
}
