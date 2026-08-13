/**
 * How recently an item must have been created to animate its grid entrance.
 * New items arrive via a refetch (not an optimistic insert), so this window
 * distinguishes a freshly-added upload/note/URL from items brought in by
 * pagination or a search — which are older and should appear instantly.
 */
export const GROW_IN_WINDOW_MS = 10_000;

/**
 * Whether an item was created recently enough to grow in. `createdAt` is the
 * server ISO timestamp; a small clock skew that puts it slightly in the future
 * still counts as fresh (the difference stays under the window).
 */
export function isFreshlyAdded(
  createdAt: string,
  nowMs: number,
  windowMs: number = GROW_IN_WINDOW_MS,
): boolean {
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && nowMs - created < windowMs;
}

/**
 * The height (px) a frame settles at, from the measured column width and the
 * frame's aspect (width/height are the masonry aspect props, not real pixels).
 * Animating an explicit height to this value is linear in pixels — unlike
 * transitioning `aspect-ratio`, whose interpolation of the ratio keeps the box
 * near-zero until the very end of the tween.
 */
export function growInTargetPx(
  columnWidth: number,
  width: number,
  height: number,
): number {
  return columnWidth * (height / width);
}
