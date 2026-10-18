// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSignIn, mockSignOut, mockCreateClient } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));

import { verifyPassword } from "./verify-password";

const CREDENTIALS = { email: "owner@example.com", password: "pw" };

describe("verifyPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    mockCreateClient.mockReturnValue({
      auth: { signInWithPassword: mockSignIn, signOut: mockSignOut },
    });
  });

  it("checks on a throwaway client so the cookie session is untouched", async () => {
    mockSignIn.mockResolvedValue({ error: null });

    expect(await verifyPassword(CREDENTIALS)).toBe(true);

    expect(mockCreateClient).toHaveBeenCalledWith(
      "http://supabase.test",
      "anon",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    // The session the check created is revoked straight away
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("resolves false for wrong credentials", async () => {
    mockSignIn.mockResolvedValue({ error: { status: 400 } });
    expect(await verifyPassword(CREDENTIALS)).toBe(false);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("throws when the check itself fails (e.g. auth rate limit)", async () => {
    const error = { status: 429, message: "rate limited" };
    mockSignIn.mockResolvedValue({ error });
    await expect(verifyPassword(CREDENTIALS)).rejects.toBe(error);
  });
});
