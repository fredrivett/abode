import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createLogger } from "@/lib/logger.server";
import { needsMFAChallenge } from "@/lib/mfa";

const log = createLogger("lib/supabase/server");

/**
 * Creates a Supabase client for use in Server Components, Server Actions, and
 * Route Handlers. Wires cookies through Next.js `cookies()` for session access.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

/**
 * Get the authenticated user from Supabase auth.
 * Returns null if not authenticated.
 */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Cookie-session equivalent of `supabase.auth.getUser()` for API route handlers,
 * with 2FA enforced. When the user has a verified MFA factor but the session is
 * still AAL1 (password sign-in, TOTP challenge not completed), the user is
 * nulled out so the caller's existing `if (!user)` guard returns 401.
 *
 * The page middleware only guards page navigations; an API route can be called
 * directly with a valid AAL1 cookie, so it must gate MFA itself. Mirrors the
 * check on the bearer and cookie paths in authenticateRequest. Returns the same
 * shape as getUser so it's a drop-in replacement.
 */
export async function getUserWithMfa(supabase: SupabaseClient) {
  const result = await supabase.auth.getUser();
  if (result.data.user && (await needsMFAChallenge(supabase))) {
    log.warn(
      { userId: result.data.user.id },
      "Rejected AAL1 cookie session for a user with a verified MFA factor",
    );
    return { data: { user: null }, error: result.error };
  }
  return result;
}
