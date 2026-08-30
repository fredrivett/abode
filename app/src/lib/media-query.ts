/**
 * Subscribe to a MediaQueryList's `change` events, falling back to the
 * deprecated `addListener`/`removeListener` for Safari < 14 (which lacks
 * `addEventListener` on MediaQueryList) so callers degrade gracefully instead
 * of throwing. Returns an unsubscribe function that mirrors the path taken.
 */
export function subscribeMediaQuery(
  mediaQuery: MediaQueryList,
  listener: () => void,
): () => void {
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", listener);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(listener);
  }

  return () => {
    if (typeof mediaQuery.removeEventListener === "function") {
      mediaQuery.removeEventListener("change", listener);
    } else if (typeof mediaQuery.removeListener === "function") {
      mediaQuery.removeListener(listener);
    }
  };
}
