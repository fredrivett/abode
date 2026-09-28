import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUserWithMfa, mockCreate, mockCapture } = vi.hoisted(() => ({
  mockGetUserWithMfa: vi.fn(),
  mockCreate: vi.fn(),
  mockCapture: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: mockGetUserWithMfa,
}));

vi.mock("@/lib/personal-access-tokens", () => ({
  createPersonalAccessToken: mockCreate,
  listPersonalAccessTokens: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true }),
  getRateLimitHeaders: () => ({}),
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: mockCapture }),
  captureServerException: vi.fn(),
}));

vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { POST } from "./route";

function request(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUserWithMfa.mockResolvedValue({
    data: { user: { id: "user_1" } },
    error: null,
  });
  mockCreate.mockImplementation(async (_userId, { scopes }) => ({
    token: "abode_pat_x",
    summary: { id: "tok_1", expiresAt: null, scopes },
  }));
});

describe("POST /api/v1/tokens", () => {
  it("rejects a request without a session that passed 2FA", async () => {
    mockGetUserWithMfa.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(request({ name: "x", scopes: ["read"] }));
    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a save-only token", async () => {
    const res = await POST(request({ name: "Shortcut", scopes: ["write"] }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith("user_1", {
      name: "Shortcut",
      expiresInDays: null,
      scopes: ["write"],
    });
    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "token_created",
        properties: expect.objectContaining({ scopes: ["write"] }),
      }),
    );
  });

  it("stores scopes deduped in canonical order", async () => {
    await POST(request({ name: "Both", scopes: ["write", "read", "write"] }));
    expect(mockCreate).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ scopes: ["read", "write"] }),
    );
  });

  it("defaults to read-only when scopes are omitted", async () => {
    await POST(request({ name: "Legacy client" }));
    expect(mockCreate).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ scopes: ["read"] }),
    );
  });

  it("rejects an empty scope list", async () => {
    const res = await POST(request({ name: "Nothing", scopes: [] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Choose at least one permission",
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects an unknown scope", async () => {
    const res = await POST(request({ name: "Admin", scopes: ["admin"] }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
