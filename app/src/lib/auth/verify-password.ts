import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Check a signed-in user's password without touching their session.
 *
 * Signing in on the cookie client would replace the current session — and drop
 * a 2FA user back to AAL1 — so this signs in on a throwaway, non-persisting
 * client and then revokes just that new session. Resolves false for a wrong
 * password; throws when the password couldn't be checked.
 */
export async function verifyPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<boolean> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  const supabase = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // 400 = wrong credentials; anything else (rate limit, outage) is a failure
  // to check, not a wrong password
  if (error?.status === 400) return false;
  if (error) throw error;
  await supabase.auth.signOut({ scope: "local" });
  return true;
}
