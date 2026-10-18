import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Who a request is acting for. A frame opens with no viewer (anonymous); the
 * auth helpers fill it in once they know who's asking, so the database client
 * restricts every query to that user's rows (see `@/lib/db`).
 */
export type ViewerFrame = { viewerId: string | null };

const frames = new AsyncLocalStorage<ViewerFrame>();

/** Run `run` in a fresh viewer frame — anonymous until an auth helper records a user */
export function runInViewerFrame<T>(run: () => T): T {
  return frames.run({ viewerId: null }, run);
}

/**
 * Record the authenticated user for the current frame, if there is one. A
 * frame acts for one user: recording someone else later would switch whose
 * rows the rest of the request can touch, so it throws instead.
 */
export function recordViewer(viewerId: string): void {
  const frame = frames.getStore();
  if (!frame) return;
  if (frame.viewerId !== null && frame.viewerId !== viewerId) {
    throw new Error("A request frame can't switch to a different viewer");
  }
  frame.viewerId = viewerId;
}

/** The current frame, or undefined outside any request frame (background jobs, scripts) */
export function currentViewerFrame(): ViewerFrame | undefined {
  return frames.getStore();
}

/**
 * Whether request frames run as the restricted `abode_app` role. Off by
 * default so the plumbing can ship before any path depends on it.
 */
export function isRlsEnforced(): boolean {
  return process.env.RLS_ENFORCED === "true";
}
