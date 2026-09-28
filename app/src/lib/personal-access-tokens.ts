import type { PersonalAccessToken } from "@prisma/client";
import { generatePersonalAccessToken } from "@/lib/auth/personal-access-token";
import type { TokenScope } from "@/lib/auth/token-scopes";
import db from "@/lib/db";
import { isCanonicalUuid } from "@/lib/pagination";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Public shape of a token for listing — never includes the raw secret or its
 * hash. Dates are ISO strings so it's safe to hand straight to a client.
 */
export type PersonalAccessTokenSummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  /** Items this token saved that still exist */
  itemCount: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

function toSummary(
  token: PersonalAccessToken,
  itemCount: number,
): PersonalAccessTokenSummary {
  return {
    id: token.id,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    scopes: token.scopes,
    itemCount,
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
    include: { _count: { select: { items: true } } },
  });
  return tokens.map(({ _count, ...token }) => toSummary(token, _count.items));
}

export type CreatePersonalAccessTokenResult = {
  /** The raw token — returned once, never persisted. Surface it to the user immediately. */
  token: string;
  summary: PersonalAccessTokenSummary;
};

/**
 * Mint a token for a user. Persists only the hash + display prefix and returns
 * the raw token once for the caller to show. `expiresInDays` null = no expiry.
 * `scopes` must be non-empty (validated at the route).
 */
export async function createPersonalAccessToken(
  userId: string,
  {
    name,
    expiresInDays,
    scopes,
  }: { name: string; expiresInDays: number | null; scopes: TokenScope[] },
): Promise<CreatePersonalAccessTokenResult> {
  const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();
  const expiresAt =
    expiresInDays != null
      ? new Date(Date.now() + expiresInDays * MS_PER_DAY)
      : null;

  const record = await db.personalAccessToken.create({
    data: { userId, name, tokenHash, tokenPrefix, expiresAt, scopes },
  });

  return { token, summary: toSummary(record, 0) };
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
  if (!isCanonicalUuid(id)) {
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
