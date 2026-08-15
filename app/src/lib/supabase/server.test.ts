import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

// server.ts imports next/headers at module load; cookies() is never called in
// these tests (they exercise getUserWithMfa, not createClient), but the import
// must resolve.
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

import { getUserWithMfa } from "./server";

type FakeClientOptions = {
  user: { id: string } | null;
  currentLevel?: "aal1" | "aal2";
  verifiedFactor?: boolean;
};

// Minimal stand-in for the cookie Supabase client: just the auth surface
// getUserWithMfa / needsMFAChallenge touch.
function fakeClient({
  user,
  currentLevel = "aal1",
  verifiedFactor = false,
}: FakeClientOptions): SupabaseClient {
  const totp = verifiedFactor ? [{ status: "verified" }] : [];
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel, nextLevel: verifiedFactor ? "aal2" : "aal1" },
          error: null,
        }),
        listFactors: async () => ({ data: { totp }, error: null }),
      },
    },
  } as unknown as SupabaseClient;
}

describe("getUserWithMfa", () => {
  it("returns the user when no MFA factor is enrolled", async () => {
    const result = await getUserWithMfa(
      fakeClient({ user: { id: "u1" }, currentLevel: "aal1" }),
    );

    expect(result.data.user).toEqual({ id: "u1" });
  });

  it("returns the user when a verified factor exists and the session is AAL2", async () => {
    const result = await getUserWithMfa(
      fakeClient({
        user: { id: "u1" },
        currentLevel: "aal2",
        verifiedFactor: true,
      }),
    );

    expect(result.data.user).toEqual({ id: "u1" });
  });

  it("nulls the user when a verified factor exists but the session is AAL1", async () => {
    const result = await getUserWithMfa(
      fakeClient({
        user: { id: "u1" },
        currentLevel: "aal1",
        verifiedFactor: true,
      }),
    );

    // 2FA enrolled but not satisfied → caller's `if (!user)` guard returns 401
    expect(result.data.user).toBeNull();
  });

  it("returns null for an unauthenticated session without checking MFA", async () => {
    const result = await getUserWithMfa(fakeClient({ user: null }));

    expect(result.data.user).toBeNull();
  });
});
