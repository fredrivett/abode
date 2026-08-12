import type { PersonalAccessToken } from "@prisma/client";
import { generatePersonalAccessToken } from "@/lib/auth/personal-access-token";
import db from "@/lib/db";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public shape of a token for listing — never includes the raw secret or its
 * hash. Dates are ISO strings so it's safe to hand straight to a client.
 */
export type PersonalAccessTokenSummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

function toSummary(token: PersonalAccessToken): PersonalAccessTokenSummary {
  return {
    id: token.id,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    scopes: token.scopes,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    expiresAt: token.expiresAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString(),
  };
}

/** List a user's active (non-revoked) tokens, newest first. */
export async function listPersonalAccessTokens(
  userId: string,
): Promise<PersonalAccessTokenSummary[]> {
  const tokens = await db.personalAccessToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return tokens.map(toSummary);
}

export type CreatePersonalAccessTokenResult = {
  /** The raw token — returned once, never persisted. Surface it to the user immediately. */
  token: string;
  summary: PersonalAccessTokenSummary;
};

/**
 * Mint a token for a user. Persists only the hash + display prefix and returns
 * the raw token once for the caller to show. `expiresInDays` null = no expiry.
 */
export async function createPersonalAccessToken(
  userId: string,
  { name, expiresInDays }: { name: string; expiresInDays: number | null },
): Promise<CreatePersonalAccessTokenResult> {
  const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();
  const expiresAt =
    expiresInDays != null
      ? new Date(Date.now() + expiresInDays * MS_PER_DAY)
      : null;

  const record = await db.personalAccessToken.create({
    data: { userId, name, tokenHash, tokenPrefix, expiresAt },
  });

  return { token, summary: toSummary(record) };
}

export type RevokePersonalAccessTokenResult =
  | { success: true }
  | { success: false; error: string; code: "NOT_FOUND" };

/**
 * Revoke a token (soft delete via revokedAt). Scoped to the owner in a single
 * atomic updateMany, so it neither touches nor reveals the existence of another
 * user's tokens; an unknown or already-revoked token reads as not found.
 * authenticateRequest rejects tokens once revokedAt is set.
 */
export async function revokePersonalAccessToken(
  id: string,
  userId: string,
): Promise<RevokePersonalAccessTokenResult> {
  // Guard the uuid-typed column: a malformed id would otherwise throw at the DB
  // and surface as a 500 rather than the intended not-found
  if (!UUID_RE.test(id)) {
    return { success: false, error: "Token not found", code: "NOT_FOUND" };
  }

  const result = await db.personalAccessToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (result.count === 0) {
    return { success: false, error: "Token not found", code: "NOT_FOUND" };
  }
  return { success: true };
}
