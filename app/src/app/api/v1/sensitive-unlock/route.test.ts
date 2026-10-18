// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockVerifyPassword, mockCapture } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockVerifyPassword: vi.fn(),
  mockCapture: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: mockGetUser,
}));
vi.mock("@/lib/auth/verify-password", () => ({
  verifyPassword: mockVerifyPassword,
}));
vi.mock("@/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
  getPostHogClient: () => ({ capture: mockCapture }),
}));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { SENSITIVE_UNLOCK_COOKIE } from "@/lib/items/sensitive-unlock";
import { clearRateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

const USER = { id: "user-1", email: "owner@example.com" };

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/v1/sensitive-unlock", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/v1/sensitive-unlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimit(USER.id);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
  });

  it("rejects a signed-out request", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await post({ password: "pw" });
    expect(res.status).toBe(401);
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it("rejects a missing password without checking it", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it("sets a short-lived httpOnly unlock cookie for the right password", async () => {
    mockVerifyPassword.mockResolvedValue(true);

    const res = await post({ password: "correct" });

    expect(res.status).toBe(200);
    expect(mockVerifyPassword).toHaveBeenCalledWith({
      email: USER.email,
      password: "correct",
    });
    const cookie = res.cookies.get(SENSITIVE_UNLOCK_COOKIE);
    expect(cookie?.value).toMatch(/^user-1\.\d+\./);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.maxAge).toBe(120);
    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({ event: "sensitive_item_unlocked" }),
    );
  });

  it("answers a wrong password with 403 (not 401) and no cookie", async () => {
    mockVerifyPassword.mockResolvedValue(false);

    const res = await post({ password: "wrong" });

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "incorrect_password" });
    expect(res.cookies.get(SENSITIVE_UNLOCK_COOKIE)).toBeUndefined();
    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({ event: "sensitive_unlock_failed" }),
    );
  });

  it("rate-limits password attempts", async () => {
    mockVerifyPassword.mockResolvedValue(false);
    for (let i = 0; i < 5; i++) await post({ password: "guess" });

    const res = await post({ password: "guess" });

    expect(res.status).toBe(429);
    expect(mockVerifyPassword).toHaveBeenCalledTimes(5);
  });

  it("returns 500 when the password couldn't be checked", async () => {
    mockVerifyPassword.mockRejectedValue(new Error("auth down"));
    const res = await post({ password: "pw" });
    expect(res.status).toBe(500);
    expect(res.cookies.get(SENSITIVE_UNLOCK_COOKIE)).toBeUndefined();
  });
});
