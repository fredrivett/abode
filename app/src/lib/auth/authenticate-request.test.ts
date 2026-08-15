import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Cookie path uses @/lib/supabase/server; Supabase-token bearer path uses
// @supabase/supabase-js; PAT path uses @/lib/db + the service-role admin client.
const {
  mockCookieGetUser,
  mockCookieAAL,
  mockCookieListFactors,
  mockBearerGetUser,
  mockCreateSupabaseClient,
  mockFindUnique,
  mockUpdateMany,
  mockAdminGetUserById,
} = vi.hoisted(() => ({
  mockCookieGetUser: vi.fn(),
  mockCookieAAL: vi.fn(),
  mockCookieListFactors: vi.fn(),
  mockBearerGetUser: vi.fn(),
  mockCreateSupabaseClient: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockAdminGetUserById: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: mockCookieGetUser,
      mfa: {
        getAuthenticatorAssuranceLevel: mockCookieAAL,
        listFactors: mockCookieListFactors,
      },
    },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => {
    mockCreateSupabaseClient(...args);
    return { auth: { getUser: mockBearerGetUser } };
  },
}));

vi.mock("@/lib/db", () => ({
  default: {
    personalAccessToken: {
      findUnique: mockFindUnique,
      updateMany: mockUpdateMany,
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    auth: { admin: { getUserById: mockAdminGetUserById } },
  }),
}));

import { authenticateRequest } from "./authenticate-request";
import { hashPersonalAccessToken } from "./personal-access-token";

// Minimal unsigned JWT carrying an `aal` claim — the gate only reads the payload
// (the token is already validated against the auth server by getUser).
function jwt(aal: string): string {
  const payload = Buffer.from(JSON.stringify({ aal })).toString("base64url");
  return `header.${payload}.signature`;
}

function request(authorization?: string) {
  return {
    headers: {
      get: (key: string) =>
        key.toLowerCase() === "authorization" ? (authorization ?? null) : null,
    },
  } as unknown as Parameters<typeof authenticateRequest>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateMany.mockResolvedValue({ count: 1 });
  // Default cookie session: no MFA enrolled
  mockCookieAAL.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
  mockCookieListFactors.mockResolvedValue({ data: { totp: [] }, error: null });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authenticateRequest", () => {
  it("resolves the user from a valid bearer token", async () => {
    mockBearerGetUser.mockResolvedValue({
      data: { user: { id: "u_bearer" } },
      error: null,
    });

    const result = await authenticateRequest(request("Bearer token-abc"));

    expect(result).toEqual({ user: { id: "u_bearer" }, method: "bearer" });
    // The bearer token is validated, never the cookie session.
    expect(mockBearerGetUser).toHaveBeenCalledWith("token-abc");
    expect(mockCookieGetUser).not.toHaveBeenCalled();
  });

  it("parses the token case-insensitively and trims whitespace", async () => {
    mockBearerGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    await authenticateRequest(request("bearer   spaced-token  "));

    expect(mockBearerGetUser).toHaveBeenCalledWith("spaced-token");
  });

  it("returns null for an invalid bearer token without falling back to cookies", async () => {
    mockBearerGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid jwt" },
    });
    mockCookieGetUser.mockResolvedValue({
      data: { user: { id: "u_cookie" } },
      error: null,
    });

    const result = await authenticateRequest(request("Bearer bad"));

    expect(result).toBeNull();
    expect(mockCookieGetUser).not.toHaveBeenCalled();
  });

  it("falls back to the cookie session when there is no Authorization header", async () => {
    mockCookieGetUser.mockResolvedValue({
      data: { user: { id: "u_cookie" } },
      error: null,
    });

    const result = await authenticateRequest(request());

    expect(result).toEqual({ user: { id: "u_cookie" }, method: "cookie" });
    expect(mockBearerGetUser).not.toHaveBeenCalled();
  });

  it("rejects an AAL1 cookie session for a user with a verified MFA factor", async () => {
    mockCookieGetUser.mockResolvedValue({
      data: { user: { id: "u_cookie" } },
      error: null,
    });
    mockCookieAAL.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
    mockCookieListFactors.mockResolvedValue({
      data: { totp: [{ status: "verified" }] },
      error: null,
    });

    // A direct API call with an unverified (AAL1) cookie must not bypass 2FA,
    // even though the page middleware would only redirect page navigations
    const result = await authenticateRequest(request());

    expect(result).toBeNull();
  });

  it("accepts an AAL2 cookie session for a user with a verified MFA factor", async () => {
    mockCookieGetUser.mockResolvedValue({
      data: { user: { id: "u_cookie" } },
      error: null,
    });
    mockCookieAAL.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    });
    mockCookieListFactors.mockResolvedValue({
      data: { totp: [{ status: "verified" }] },
      error: null,
    });

    const result = await authenticateRequest(request());

    expect(result).toEqual({ user: { id: "u_cookie" }, method: "cookie" });
  });

  it("fails closed: rejects the cookie session when the MFA lookup errors", async () => {
    mockCookieGetUser.mockResolvedValue({
      data: { user: { id: "u_cookie" } },
      error: null,
    });
    // A transient Supabase failure during the MFA check must not grant access
    mockCookieAAL.mockRejectedValue(new Error("supabase unavailable"));

    const result = await authenticateRequest(request());

    expect(result).toBeNull();
  });

  it("uses the cookie session for a non-Bearer Authorization scheme", async () => {
    mockCookieGetUser.mockResolvedValue({
      data: { user: { id: "u_cookie" } },
      error: null,
    });

    const result = await authenticateRequest(request("Basic abc123"));

    expect(result).toEqual({ user: { id: "u_cookie" }, method: "cookie" });
    expect(mockBearerGetUser).not.toHaveBeenCalled();
  });

  it("returns null when neither a bearer token nor a cookie session is present", async () => {
    mockCookieGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await authenticateRequest(request());

    expect(result).toBeNull();
  });

  it("accepts an AAL2 bearer token for a user with a verified MFA factor", async () => {
    mockBearerGetUser.mockResolvedValue({
      data: {
        user: { id: "u_mfa", factors: [{ status: "verified" }] },
      },
      error: null,
    });

    const result = await authenticateRequest(request(`Bearer ${jwt("aal2")}`));

    expect(result).toEqual({
      user: { id: "u_mfa", factors: [{ status: "verified" }] },
      method: "bearer",
    });
  });

  it("rejects an AAL1 bearer token for a user with a verified MFA factor", async () => {
    mockBearerGetUser.mockResolvedValue({
      data: {
        user: { id: "u_mfa", factors: [{ status: "verified" }] },
      },
      error: null,
    });
    mockCookieGetUser.mockResolvedValue({
      data: { user: { id: "u_cookie" } },
      error: null,
    });

    const result = await authenticateRequest(request(`Bearer ${jwt("aal1")}`));

    // 2FA is enrolled but not satisfied → treated as unauthenticated, and never
    // a silent fallback to the cookie session
    expect(result).toBeNull();
    expect(mockCookieGetUser).not.toHaveBeenCalled();
  });

  it("fails closed: rejects an unparseable token for a user with a verified factor", async () => {
    mockBearerGetUser.mockResolvedValue({
      data: {
        user: { id: "u_mfa", factors: [{ status: "verified" }] },
      },
      error: null,
    });

    // getUser somehow validated it, but there is no readable aal claim
    const result = await authenticateRequest(request("Bearer not-a-jwt"));

    expect(result).toBeNull();
  });

  it("accepts an AAL1 bearer token when the user has no verified factor", async () => {
    mockBearerGetUser.mockResolvedValue({
      data: {
        // an unverified (mid-enrollment) factor is not active 2FA
        user: { id: "u_nomfa", factors: [{ status: "unverified" }] },
      },
      error: null,
    });

    const result = await authenticateRequest(request(`Bearer ${jwt("aal1")}`));

    expect(result).toEqual({
      user: { id: "u_nomfa", factors: [{ status: "unverified" }] },
      method: "bearer",
    });
  });

  it("accepts a bearer token for a user with no factors field", async () => {
    mockBearerGetUser.mockResolvedValue({
      data: { user: { id: "u_plain" } },
      error: null,
    });

    const result = await authenticateRequest(request(`Bearer ${jwt("aal1")}`));

    expect(result).toEqual({ user: { id: "u_plain" }, method: "bearer" });
  });

  it("returns null for a bearer token when Supabase env is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const result = await authenticateRequest(request("Bearer token-abc"));

    expect(result).toBeNull();
    expect(mockBearerGetUser).not.toHaveBeenCalled();
  });
});

describe("authenticateRequest — personal access tokens", () => {
  const PAT = "abode_pat_exampletoken";
  const PAT_HASH = hashPersonalAccessToken(PAT);

  function patRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: "tok_1",
      userId: "u_pat",
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
      ...overrides,
    };
  }

  function withUser(id = "u_pat") {
    mockAdminGetUserById.mockResolvedValue({
      data: { user: { id } },
      error: null,
    });
  }

  it("resolves the user for a valid token and routes to the PAT path only", async () => {
    mockFindUnique.mockResolvedValue(patRecord());
    withUser();

    const result = await authenticateRequest(request(`Bearer ${PAT}`));

    expect(result).toEqual({ user: { id: "u_pat" }, method: "pat" });
    // Looked up by hash, never the raw token
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { tokenHash: PAT_HASH },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
      },
    });
    expect(mockAdminGetUserById).toHaveBeenCalledWith("u_pat");
    // The Supabase-token and cookie paths are never touched
    expect(mockBearerGetUser).not.toHaveBeenCalled();
    expect(mockCookieGetUser).not.toHaveBeenCalled();
  });

  it("bumps last_used_at when stale, via an atomic conditional updateMany", async () => {
    mockFindUnique.mockResolvedValue(
      patRecord({ lastUsedAt: new Date(Date.now() - 5 * 60 * 1000) }),
    );
    withUser();

    await authenticateRequest(request(`Bearer ${PAT}`));

    // The write re-checks the window in the WHERE clause, so concurrent requests
    // racing at the boundary still yield a single write
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "tok_1",
        OR: [{ lastUsedAt: null }, { lastUsedAt: { lte: expect.any(Date) } }],
      },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("bumps last_used_at when it has never been used", async () => {
    mockFindUnique.mockResolvedValue(patRecord({ lastUsedAt: null }));
    withUser();

    await authenticateRequest(request(`Bearer ${PAT}`));

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("issues no write when last_used_at is within the throttle window", async () => {
    mockFindUnique.mockResolvedValue(patRecord({ lastUsedAt: new Date() }));
    withUser();

    const result = await authenticateRequest(request(`Bearer ${PAT}`));

    // Fast path: the already-fetched lastUsedAt gates the write, so a busy token
    // issues no extra query at all
    expect(result).toEqual({ user: { id: "u_pat" }, method: "pat" });
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("returns null for an unknown token without falling back to cookies", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await authenticateRequest(request(`Bearer ${PAT}`));

    expect(result).toBeNull();
    expect(mockAdminGetUserById).not.toHaveBeenCalled();
    expect(mockCookieGetUser).not.toHaveBeenCalled();
  });

  it("returns null for a revoked token", async () => {
    mockFindUnique.mockResolvedValue(patRecord({ revokedAt: new Date() }));

    const result = await authenticateRequest(request(`Bearer ${PAT}`));

    expect(result).toBeNull();
    expect(mockAdminGetUserById).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("returns null for an expired token", async () => {
    mockFindUnique.mockResolvedValue(
      patRecord({ expiresAt: new Date(Date.now() - 1000) }),
    );

    const result = await authenticateRequest(request(`Bearer ${PAT}`));

    expect(result).toBeNull();
    expect(mockAdminGetUserById).not.toHaveBeenCalled();
  });

  it("accepts a token whose expiry is in the future", async () => {
    mockFindUnique.mockResolvedValue(
      patRecord({ expiresAt: new Date(Date.now() + 60 * 60 * 1000) }),
    );
    withUser();

    const result = await authenticateRequest(request(`Bearer ${PAT}`));

    expect(result).toEqual({ user: { id: "u_pat" }, method: "pat" });
  });

  it("returns null and skips the last-used write when the auth user cannot be loaded", async () => {
    mockFindUnique.mockResolvedValue(patRecord());
    mockAdminGetUserById.mockResolvedValue({
      data: { user: null },
      error: { message: "not found" },
    });

    const result = await authenticateRequest(request(`Bearer ${PAT}`));

    expect(result).toBeNull();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});
