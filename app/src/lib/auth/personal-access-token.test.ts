import { describe, expect, it } from "vitest";
import {
  generatePersonalAccessToken,
  hashPersonalAccessToken,
  isPersonalAccessTokenFormat,
  PERSONAL_ACCESS_TOKEN_PREFIX,
} from "./personal-access-token";

describe("generatePersonalAccessToken", () => {
  it("returns a token with the recognizable prefix", () => {
    const { token } = generatePersonalAccessToken();
    expect(token.startsWith(PERSONAL_ACCESS_TOKEN_PREFIX)).toBe(true);
  });

  it("carries at least 256 bits of entropy after the prefix", () => {
    const { token } = generatePersonalAccessToken();
    const random = token.slice(PERSONAL_ACCESS_TOKEN_PREFIX.length);
    // 32 bytes base64url-encoded is 43 chars
    expect(random.length).toBeGreaterThanOrEqual(43);
  });

  it("generates a unique token on every call", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generatePersonalAccessToken().token),
    );
    expect(tokens.size).toBe(100);
  });

  it("stores the hash of the raw token, not the token itself", () => {
    const { token, tokenHash } = generatePersonalAccessToken();
    expect(tokenHash).not.toContain(token);
    expect(tokenHash).toBe(hashPersonalAccessToken(token));
  });

  it("derives tokenPrefix as a leading slice of the raw token", () => {
    const { token, tokenPrefix } = generatePersonalAccessToken();
    expect(token.startsWith(tokenPrefix)).toBe(true);
    expect(tokenPrefix.startsWith(PERSONAL_ACCESS_TOKEN_PREFIX)).toBe(true);
    // longer than the bare prefix so distinct tokens are distinguishable in the UI
    expect(tokenPrefix.length).toBeGreaterThan(
      PERSONAL_ACCESS_TOKEN_PREFIX.length,
    );
  });
});

describe("hashPersonalAccessToken", () => {
  it("is a deterministic 64-char hex SHA-256 digest", () => {
    const hash = hashPersonalAccessToken("abode_pat_example");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPersonalAccessToken("abode_pat_example")).toBe(hash);
  });

  it("produces different hashes for different inputs", () => {
    expect(hashPersonalAccessToken("abode_pat_a")).not.toBe(
      hashPersonalAccessToken("abode_pat_b"),
    );
  });
});

describe("isPersonalAccessTokenFormat", () => {
  it("accepts our tokens", () => {
    const { token } = generatePersonalAccessToken();
    expect(isPersonalAccessTokenFormat(token)).toBe(true);
  });

  it("rejects a Supabase-style access token", () => {
    expect(
      isPersonalAccessTokenFormat("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc"),
    ).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isPersonalAccessTokenFormat("")).toBe(false);
  });
});
