import { createHash, randomBytes } from "node:crypto";

/**
 * Personal access tokens authenticate machine-to-machine API requests (the MCP
 * server, scripts) that can't hold a Supabase cookie session. Only the SHA-256
 * hash is persisted (`PersonalAccessToken.tokenHash`); the raw token is shown to
 * the user exactly once at creation and is unrecoverable afterwards.
 *
 * The prefix is recognizable so leaked tokens are easy to spot (and scannable by
 * secret-detection tooling). `resolveBearerUser` in `authenticate-request.ts`
 * detects it to route validation to the token path.
 */
export const PERSONAL_ACCESS_TOKEN_PREFIX = "abode_pat_";

// Length of the leading slice stored for display/identification, e.g. "abode_pat_a1b2c3"
const DISPLAY_PREFIX_LENGTH = PERSONAL_ACCESS_TOKEN_PREFIX.length + 6;

// 32 bytes = 256 bits of entropy; base64url keeps it URL/header-safe with no padding
const TOKEN_ENTROPY_BYTES = 32;

export interface GeneratedPersonalAccessToken {
  /** The raw token — return to the user once, never store */
  token: string;
  /** SHA-256 hash of the raw token — this is what gets persisted */
  tokenHash: string;
  /** Leading chars for display in the UI without exposing the secret */
  tokenPrefix: string;
}

/**
 * Mint a new personal access token. The raw `token` is returned to the caller
 * once; persist only `tokenHash` and `tokenPrefix`.
 */
export function generatePersonalAccessToken(): GeneratedPersonalAccessToken {
  const token = `${PERSONAL_ACCESS_TOKEN_PREFIX}${randomBytes(TOKEN_ENTROPY_BYTES).toString("base64url")}`;
  return {
    token,
    tokenHash: hashPersonalAccessToken(token),
    tokenPrefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
  };
}

/**
 * SHA-256 hash of a raw token, hex-encoded. The token is high-entropy random, so
 * a fast hash is the standard choice — a slow KDF (bcrypt/argon) would only add
 * per-request latency without meaningfully raising the bar on a 256-bit secret.
 */
export function hashPersonalAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * True when a bearer value looks like one of our personal access tokens. Used to
 * route bearer auth to the token path vs. Supabase access tokens.
 */
export function isPersonalAccessTokenFormat(token: string): boolean {
  return token.startsWith(PERSONAL_ACCESS_TOKEN_PREFIX);
}
