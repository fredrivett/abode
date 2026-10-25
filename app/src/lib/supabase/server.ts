import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { createLogger } from "@/lib/logger.server";
import { needsMFAChallenge } from "@/lib/mfa";
import { recordViewer } from "@/lib/viewer-context";

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
 * Returns null if not authenticated or the session still owes its MFA
 * challenge.
 */
export async function getAuthUser() {
  const {
    data: { user },
  } = await getRequestUserWithMfa();
  return user;
}

// One Supabase Auth round trip per server render: a dashboard load resolves
// the user in the (app) layout, the dashboard layout, the header and the page,
// and each `getUser` (plus `getClaims` on symmetric-key projects) is a network
// call made before any HTML reaches the browser
const resolveRequestUser = cache(async () =>
  getUserWithMfa(await createClient()),
);
const resolveRequestClaims = cache(async () =>
  (await createClient()).auth.getClaims(),
);

/**
 * {@link getUserWithMfa} for the cookie session, resolved once per server
 * render (React `cache`) however many layouts, pages and components ask. For
 * server components only: in a server action or route handler that signs in or
 * out, call {@link getUserWithMfa} on that request's client instead.
 */
export async function getRequestUserWithMfa() {
  const result = await resolveRequestUser();
  // Recorded on every call: each caller may run in its own viewer frame
  if (result.data.user) recordViewer(result.data.user.id);
  return result;
}

/** The session's JWT claims, resolved once per server render (see {@link getRequestUserWithMfa}) */
export function getRequestClaims() {
  return resolveRequestClaims();
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
  const user = result.data.user;
  if (!user) return result;

  // Fail closed if the MFA lookup itself errors — a transient Supabase failure
  // must not serve a user who may still owe a challenge (a 401, not a 500).
  const mfaIncomplete = await needsMFAChallenge(supabase).catch((error) => {
    log.warn(
      { userId: user.id, error },
      "MFA state check failed; failing closed",
    );
    return true;
  });
  if (mfaIncomplete) {
    log.warn(
      { userId: user.id },
      "Rejected cookie session pending MFA challenge",
    );
    return { data: { user: null }, error: result.error };
  }

  // The rest of the request acts for this user (row level security)
  recordViewer(user.id);
  return result;
}
