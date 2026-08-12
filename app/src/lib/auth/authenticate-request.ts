import type { User } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  hashPersonalAccessToken,
  isPersonalAccessTokenFormat,
} from "@/lib/auth/personal-access-token";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
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
  return user ? { user, method: "cookie" } : null;
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
