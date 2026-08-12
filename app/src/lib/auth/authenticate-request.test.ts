import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Cookie path uses @/lib/supabase/server; Supabase-token bearer path uses
// @supabase/supabase-js; PAT path uses @/lib/db + the service-role admin client.
const {
  mockCookieGetUser,
  mockBearerGetUser,
  mockCreateSupabaseClient,
  mockFindUnique,
  mockUpdateMany,
  mockAdminGetUserById,
} = vi.hoisted(() => ({
  mockCookieGetUser: vi.fn(),
  mockBearerGetUser: vi.fn(),
  mockCreateSupabaseClient: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockAdminGetUserById: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockCookieGetUser } }),
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
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
    expect(mockAdminGetUserById).toHaveBeenCalledWith("u_pat");
    // The Supabase-token and cookie paths are never touched
    expect(mockBearerGetUser).not.toHaveBeenCalled();
    expect(mockCookieGetUser).not.toHaveBeenCalled();
  });

  it("bumps last_used_at via an atomic conditional updateMany (throttle in the WHERE clause)", async () => {
    mockFindUnique.mockResolvedValue(patRecord());
    withUser();

    await authenticateRequest(request(`Bearer ${PAT}`));

    // The throttle is enforced by the query, not a prior read, so concurrent
    // requests can't each slip a write past a stale check
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "tok_1",
        OR: [{ lastUsedAt: null }, { lastUsedAt: { lte: expect.any(Date) } }],
      },
      data: { lastUsedAt: expect.any(Date) },
    });
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
