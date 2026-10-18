import { runInViewerFrame } from "@/lib/viewer-context";

/**
 * Wrap a route handler export so the request runs in its own viewer frame:
 *
 *   export const GET = withViewer(async (request, context) => { … });
 *
 * The frame starts anonymous; `getUserWithMfa` / `authenticateRequest` record
 * the caller once they've authenticated them. With RLS_ENFORCED on, every `db`
 * query in the frame then runs as the restricted abode_app role for that user
 * — and before authentication (or if it fails) as an anonymous viewer that
 * sees no user-owned rows (shared tables stay readable).
 */
export function withViewer<Args extends unknown[], Result>(
  handler: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return (...args) => runInViewerFrame(() => handler(...args));
}
