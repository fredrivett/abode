// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createUnlockToken,
  hasSensitiveUnlock,
  isValidUnlockToken,
} from "./sensitive-unlock";

const SECRET = "service-role-secret";
const USER = "user-1";
const NOW = 1_800_000_000_000;

function valid(token: string | undefined, overrides = {}) {
  return isValidUnlockToken({
    token,
    userId: USER,
    now: NOW,
    secret: SECRET,
    ...overrides,
  });
}

describe("sensitive unlock tokens", () => {
  const token = createUnlockToken({
    userId: USER,
    expiresAt: NOW + 60_000,
    secret: SECRET,
  });

  it("accepts an unexpired token for its user", () => {
    expect(valid(token)).toBe(true);
  });

  it("rejects a missing token", () => {
    expect(valid(undefined)).toBe(false);
  });

  it("rejects an expired token", () => {
    expect(valid(token, { now: NOW + 60_000 })).toBe(false);
  });

  it("rejects another user's token", () => {
    expect(valid(token, { userId: "user-2" })).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    expect(valid(token, { secret: "other-secret" })).toBe(false);
  });

  it("rejects a token whose expiry was extended", () => {
    const [userId, , signature] = token.split(".");
    expect(valid(`${userId}.${NOW + 3_600_000}.${signature}`)).toBe(false);
  });

  it.each([
    "garbage",
    "a.b",
    `${USER}.not-a-number.sig`,
    `${USER}.${NOW + 60_000}.`,
  ])("rejects a malformed token %s", (malformed) => {
    expect(valid(malformed)).toBe(false);
  });
});

describe("hasSensitiveUnlock", () => {
  it("is locked without a cookie, even where the signing secret is unset", () => {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      expect(hasSensitiveUnlock({ cookieValue: undefined, userId: USER })).toBe(
        false,
      );
    } finally {
      if (secret !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
    }
  });
});
