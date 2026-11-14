import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUserWithMfa, mockHasCompletedSignup } = vi.hoisted(() => ({
  mockGetUserWithMfa: vi.fn(),
  mockHasCompletedSignup: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUserWithMfa: mockGetUserWithMfa,
}));
vi.mock("@/lib/auth/has-completed-signup", () => ({
  hasCompletedSignup: mockHasCompletedSignup,
}));

import { getCompletedSignupUser } from "@/lib/auth/completed-signup-user";

const supabase = {} as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCompletedSignupUser", () => {
  it("returns null when there's no user (signed out, or MFA still owed)", async () => {
    mockGetUserWithMfa.mockResolvedValue({ data: { user: null } });

    expect(await getCompletedSignupUser(supabase)).toBeNull();
    expect(mockHasCompletedSignup).not.toHaveBeenCalled();
  });

  it("returns null when the account hasn't completed signup", async () => {
    mockGetUserWithMfa.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockHasCompletedSignup.mockResolvedValue(false);

    expect(await getCompletedSignupUser(supabase)).toBeNull();
    expect(mockHasCompletedSignup).toHaveBeenCalledWith("u1");
  });

  it("returns the user once signup is complete", async () => {
    const user = { id: "u1" };
    mockGetUserWithMfa.mockResolvedValue({ data: { user } });
    mockHasCompletedSignup.mockResolvedValue(true);

    expect(await getCompletedSignupUser(supabase)).toBe(user);
  });
});
