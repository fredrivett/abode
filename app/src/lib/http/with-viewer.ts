import { runInViewerFrame } from "@/lib/viewer-context";

const VIEWER_FRAMED = Symbol("viewerFramed");

/**
 * Wrap a route handler export so the request runs in its own viewer frame:
 *
 *   export const GET = withViewer(handleGet);
 *
 * The frame starts anonymous; `getUserWithMfa` / `authenticateRequest` record
 * the caller once they've authenticated them. With RLS_ENFORCED on, every `db`
 * query in the frame then runs as the restricted abode_app role for that user
 * — and before authentication (or if it fails) as an anonymous viewer that
 * sees no user-owned rows (shared tables stay readable).
 */
export function withViewer<Args extends unknown[], Result>(
  handler: (...args: Args) => Result,
): (...args: Args) => Result {
  const framed = (...args: Args) => runInViewerFrame(() => handler(...args));
  Object.defineProperty(framed, VIEWER_FRAMED, { value: true });
  return framed;
}

/** Whether `handler` was wrapped by withViewer (route-coverage test) */
export function isViewerFramed(handler: unknown): boolean {
  return (
    typeof handler === "function" &&
    Object.getOwnPropertyDescriptor(handler, VIEWER_FRAMED)?.value === true
  );
}
