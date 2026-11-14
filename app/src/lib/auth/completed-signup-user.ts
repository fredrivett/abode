import type { SupabaseClient, User } from "@supabase/supabase-js";
import { hasCompletedSignup } from "@/lib/auth/has-completed-signup";
import { getUserWithMfa } from "@/lib/supabase/server";

/**
 * The authenticated user for a server action, or null when there's no user,
 * the 2FA challenge is still owed, or signup isn't complete.
 *
 * Server actions are never wrapped by `(app)/layout.tsx`, so an action POSTed
 * directly only sees the guard it runs itself. `getUserWithMfa` alone lets
 * through an email-confirmed account that never claimed an invite (completing
 * signup means claiming one): it has a user but no username. That matters most
 * for `changeUsername`, which would set the username and so complete signup —
 * the invite-only barrier — without an invite. Actions that manage an existing
 * account resolve their user through this instead, so an incomplete-signup
 * account is turned away the same way the pages turn it away.
 *
 * Takes the request's client so the action keeps one Supabase client for the
 * session mutations (re-auth, email change) it makes after.
 */
export async function getCompletedSignupUser(
  supabase: SupabaseClient,
): Promise<User | null> {
  const {
    data: { user },
  } = await getUserWithMfa(supabase);
  if (!user) return null;
  return (await hasCompletedSignup(user.id)) ? user : null;
}
