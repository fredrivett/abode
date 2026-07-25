import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Cookie path uses @/lib/supabase/server; bearer path uses @supabase/supabase-js.
const { mockCookieGetUser, mockBearerGetUser, mockCreateSupabaseClient } =
  vi.hoisted(() => ({
    mockCookieGetUser: vi.fn(),
    mockBearerGetUser: vi.fn(),
    mockCreateSupabaseClient: vi.fn(),
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

import { authenticateRequest } from "./authenticate-request";

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
