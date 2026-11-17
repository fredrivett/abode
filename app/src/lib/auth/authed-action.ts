import type { Principal } from "@/lib/auth/authenticate-request";
import { getCompletedSignupUser } from "@/lib/auth/completed-signup-user";
import { createClient } from "@/lib/supabase/server";
import { runInViewerFrame } from "@/lib/viewer-context";

/**
 * Wrap a server action that needs a signed-in user:
 *
 *   export const changeUsername = authedAction(
 *     { unauthorized: { error: "Unauthorized" } },
 *     async (principal, prevState, formData) => …,
 *   );
 *
 * The action runs in its own viewer frame, so with RLS_ENFORCED on its `db`
 * queries act for the caller and the database refuses other users' rows; work
 * that genuinely spans users (is this username taken?) uses `systemRead`.
 * The caller comes from the cookie session with 2FA and completed signup
 * enforced; anyone else gets `unauthorized` without the action running.
 *
 * Server actions aren't wrapped by the `(app)` layout, so a direct POST only
 * meets the checks the action runs itself. `authed-action-gate.test.ts`
 * requires this wrapper on every `(app)` action.
 */
export function authedAction<Args extends unknown[], Result>(
  { unauthorized }: { unauthorized: Result },
  action: (principal: Principal, ...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args) =>
    runInViewerFrame(async () => {
      // Records the caller as the frame's viewer once authenticated
      const user = await getCompletedSignupUser(await createClient());
      if (!user) return unauthorized;
      return action({ user, method: "cookie" }, ...args);
    });
}
