"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IMAGE_RETRY_DELAYS_MS,
  imageSrcForAttempt,
  isRetryableImageSrc,
} from "@/lib/image-retry";

/**
 * Load an image with retry, tracking whether it has loaded (for fading a
 * placeholder out). Spread `imgProps` onto the `<img>` — it carries the `src`,
 * so don't pass one separately. A failed same-origin load (e.g. a transient
 * image-proxy 500) is retried with backoff under a cache-busting URL instead of
 * leaving the placeholder up for good; see {@link isRetryableImageSrc}.
 *
 * State resets whenever `src` changes — including when it returns to a
 * previously-loaded URL — so a stale load never hides the placeholder before
 * the current image has painted. The ref handles the already-settled case
 * (cached, or errored before hydration) where the event never reaches React.
 *
 * `imgProps.onError` returns whether a retry was scheduled, so a caller with its
 * own fallback can run it only once retries are exhausted.
 */
export function useImageLoaded(src: string | null | undefined) {
  const [trackedSrc, setTrackedSrc] = useState(src);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Adjust state during render when the source changes (React's recommended
  // pattern), so the reset is applied to the current image, not a stale one.
  if (src !== trackedSrc) {
    setTrackedSrc(src);
    setLoaded(false);
    setAttempt(0);
  }

  // Read by the stable ref callback, which can't close over fresh state
  const latest = useRef({ src, attempt });
  latest.current = { src, attempt };
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A pending retry belongs to the src it was scheduled for
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on src change to drop a stale retry
  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = null;
    };
  }, [src]);

  const onError = useCallback((): boolean => {
    const { src: current, attempt: failedAttempt } = latest.current;
    const delay = IMAGE_RETRY_DELAYS_MS[failedAttempt];
    if (!current || delay === undefined || !isRetryableImageSrc(current)) {
      return false;
    }
    if (retryTimer.current) return true; // already scheduled (e.g. twin error)
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      // A twin <img> may have loaded the old URL; hold the placeholder until
      // the retry itself paints
      setLoaded(false);
      setAttempt(failedAttempt + 1);
    }, delay);
    return true;
  }, []);

  const onLoad = useCallback(() => setLoaded(true), []);
  const ref = useCallback(
    (node: HTMLImageElement | null) => {
      if (!node?.complete) return;
      if (node.naturalWidth > 0) setLoaded(true);
      else if (node.getAttribute("src")) onError();
    },
    [onError],
  );

  return {
    loaded: !!src && loaded,
    imgProps: {
      src: src ? imageSrcForAttempt({ src, attempt }) : undefined,
      ref,
      onLoad,
      onError,
    },
  };
}
