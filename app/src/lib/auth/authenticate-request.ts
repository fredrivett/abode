import type { User } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type AuthMethod = "cookie" | "bearer";

export interface AuthenticatedRequest {
  user: User;
  method: AuthMethod;
}

/**
 * Resolves the authenticated user for an API request from either the Supabase
 * cookie session (the web app) or an `Authorization: Bearer <supabase access
 * token>` header (the browser extension, and later the mobile app). A bearer
 * token takes precedence; we fall back to cookies. Returns null when neither
 * yields a user.
 *
 * Forward-compatible with a future public API: personal-access-token support
 * slots into `resolveBearerUser` (detect a token prefix, look it up) without
 * changing any call site.
 */
export async function authenticateRequest(
  request: NextRequest,
): Promise<AuthenticatedRequest | null> {
  const token = extractBearerToken(request);
  if (token) {
    const user = await resolveBearerUser(token);
    return user ? { user, method: "bearer" } : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user, method: "cookie" } : null;
}

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Validates a bearer token and returns its user, or null. Today this only
 * handles Supabase access tokens (validated against the auth server, so revoked
 * sessions are rejected). A `abode_pat_…` branch for personal access tokens
 * would go here when a public API ships.
 */
async function resolveBearerUser(token: string): Promise<User | null> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  return error ? null : user;
}
