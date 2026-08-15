import type { User } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  hashPersonalAccessToken,
  isPersonalAccessTokenFormat,
} from "@/lib/auth/personal-access-token";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { needsMFAChallenge } from "@/lib/mfa";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("lib/auth/authenticate-request");

export type AuthMethod = "cookie" | "bearer" | "pat";

export interface AuthenticatedRequest {
  user: User;
  method: AuthMethod;
}

// Touch last_used_at at most this often, so a busy token isn't written on every request
const LAST_USED_THROTTLE_MS = 60 * 1000;

/**
 * Resolves the authenticated user for an API request from one of:
 * - a personal access token (`Authorization: Bearer abode_pat_…`) — the MCP
 *   server and scripts;
 * - a Supabase access token (`Authorization: Bearer <jwt>`) — the browser
 *   extension, and later the mobile app;
 * - the Supabase cookie session — the web app.
 *
 * A bearer token takes precedence; we fall back to cookies. A malformed or
 * rejected bearer token returns null (never a silent cookie fallback). Returns
 * null when nothing yields a user.
 *
 * Both interactive paths (bearer and cookie) reject a session that hasn't
 * completed MFA when the user has 2FA enabled — the page middleware only guards
 * page navigations, not direct API calls. Personal access tokens are exempt (an
 * explicit, user-created credential, like a GitHub PAT — MFA is a login-time
 * concern).
 */
export async function authenticateRequest(
  request: NextRequest,
): Promise<AuthenticatedRequest | null> {
  const token = extractBearerToken(request);
  if (token) {
    if (isPersonalAccessTokenFormat(token)) {
      const user = await resolvePersonalAccessTokenUser(token);
      return user ? { user, method: "pat" } : null;
    }
    const user = await resolveBearerUser(token);
    return user ? { user, method: "bearer" } : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Enforce 2FA here too, not just via the page middleware: an AAL1 cookie
  // session is set at password sign-in, before the TOTP challenge, so a direct
  // API call with that cookie would otherwise bypass the 2FA the user opted into.
  if (await needsMFAChallenge(supabase)) {
    log.warn(
      { userId: user.id },
      "Rejected AAL1 cookie session for a user with a verified MFA factor",
    );
    return null;
  }

  return { user, method: "cookie" };
}

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Validates an `abode_pat_…` personal access token against the database and
 * returns its user, or null. Rejects unknown, revoked, and expired tokens, and
 * tokens whose user the auth server can't load. Best-effort updates last_used_at
 * (throttled) without blocking the request.
 */
async function resolvePersonalAccessTokenUser(
  token: string,
): Promise<User | null> {
  const tokenHash = hashPersonalAccessToken(token);

  const record = await db.personalAccessToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
    },
  });

  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) return null;

  const user = await resolveUserById(record.userId);
  if (!user) return null;

  touchLastUsed(record.id, record.lastUsedAt);
  return user;
}

/**
 * Loads the Supabase auth user for a validated token via the service-role admin
 * client. Returns null (→ 401) rather than throwing, so a missing service-role
 * key or a since-deleted user surfaces as an auth failure, not a 500.
 */
async function resolveUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } =
      await getSupabaseAdminClient().auth.admin.getUserById(userId);
    if (error || !data.user) {
      log.warn(
        { userId, error: error?.message },
        "PAT resolved to a user the auth server could not load",
      );
      return null;
    }
    return data.user;
  } catch (error) {
    log.error({ userId, error }, "Failed to resolve PAT user via admin client");
    return null;
  }
}

/**
 * Best-effort, fire-and-forget bump of a token's last_used_at, throttled to at
 * most one write per LAST_USED_THROTTLE_MS. Never blocks or fails auth.
 *
 * Two layers: the `lastUsedAt` we already fetched gates the common case, so a
 * busy token issues no query at all once it's been bumped; the rare stale write
 * then re-checks the window in the WHERE clause, so concurrent requests racing
 * at the boundary still yield a single write (Postgres serializes the matching
 * row). No extra query per request, and no read-then-write race.
 */
function touchLastUsed(id: string, lastUsedAt: Date | null): void {
  const cutoffMs = Date.now() - LAST_USED_THROTTLE_MS;
  if (lastUsedAt && lastUsedAt.getTime() >= cutoffMs) return;

  void db.personalAccessToken
    .updateMany({
      where: {
        id,
        OR: [{ lastUsedAt: null }, { lastUsedAt: { lte: new Date(cutoffMs) } }],
      },
      data: { lastUsedAt: new Date() },
    })
    .catch((error) =>
      log.warn({ id, error }, "Failed to update PAT last_used_at"),
    );
}

/**
 * Validates a Supabase access token and returns its user, or null. Validated
 * against the auth server, so revoked sessions are rejected.
 *
 * Enforces 2FA: a user with a verified MFA factor must present an AAL2 token.
 * A password-only sign-in yields an AAL1 token (raising it to AAL2 needs a TOTP
 * challenge — the web login does this, the extension does not yet). Accepting an
 * AAL1 token here would let anyone with just the password reach the account over
 * the bearer path, silently bypassing the 2FA the user opted into. Fails closed:
 * an unparseable token is treated as non-AAL2.
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
  if (error || !user) return null;

  if (userHasVerifiedFactor(user) && decodeJwtAal(token) !== "aal2") {
    log.warn(
      { userId: user.id },
      "Rejected AAL1 bearer token for a user with a verified MFA factor",
    );
    return null;
  }

  return user;
}

/** Whether the user has a verified (i.e. active) MFA factor. */
function userHasVerifiedFactor(user: User): boolean {
  return user.factors?.some((factor) => factor.status === "verified") ?? false;
}

/**
 * Reads the `aal` (Authenticator Assurance Level) claim from a JWT without
 * verifying its signature — safe only because the caller resolves this token
 * against the auth server first. Returns null for a malformed token or a
 * missing/non-string claim, so callers can fail closed.
 */
function decodeJwtAal(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      typeof claims === "object" &&
      claims !== null &&
      "aal" in claims &&
      typeof claims.aal === "string"
    ) {
      return claims.aal;
    }
  } catch {
    // Malformed token → null → treated as non-AAL2 by the caller
  }
  return null;
}
