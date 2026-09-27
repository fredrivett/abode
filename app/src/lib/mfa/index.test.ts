import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getAAL, isMfaChallengePending, needsMFAChallenge } from "./index";

// Supabase types AAL as open-ended and passes the JWT claim through unchecked,
// so the fake accepts any string to exercise unknown levels
function fakeClient({
  currentLevel,
  nextLevel,
  verifiedFactor,
}: {
  currentLevel: string | null;
  nextLevel: string | null;
  verifiedFactor: boolean;
}): SupabaseClient {
  const totp = verifiedFactor ? [{ status: "verified" }] : [];
  return {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel, nextLevel },
          error: null,
        }),
        listFactors: async () => ({ data: { totp }, error: null }),
      },
    },
  } as unknown as SupabaseClient;
}

describe("isMfaChallengePending", () => {
  it.each([
    { currentLevel: "aal1", hasVerifiedFactor: true, expected: true },
    { currentLevel: "aal2", hasVerifiedFactor: true, expected: false },
    // Fail closed: anything other than an explicit aal2 owes the challenge
    { currentLevel: null, hasVerifiedFactor: true, expected: true },
    { currentLevel: "aal3", hasVerifiedFactor: true, expected: true },
    { currentLevel: "aal1", hasVerifiedFactor: false, expected: false },
    { currentLevel: null, hasVerifiedFactor: false, expected: false },
  ])("currentLevel=$currentLevel, factor=$hasVerifiedFactor → $expected", ({
    currentLevel,
    hasVerifiedFactor,
    expected,
  }) => {
    expect(isMfaChallengePending({ currentLevel, hasVerifiedFactor })).toBe(
      expected,
    );
  });
});

describe("getAAL", () => {
  it("passes known levels through", async () => {
    const aal = await getAAL(
      fakeClient({
        currentLevel: "aal1",
        nextLevel: "aal2",
        verifiedFactor: true,
      }),
    );

    expect(aal).toEqual({
      currentLevel: "aal1",
      nextLevel: "aal2",
      hasVerifiedFactor: true,
    });
  });

  it("normalises unrecognised levels to null", async () => {
    const aal = await getAAL(
      fakeClient({
        currentLevel: "aal3",
        nextLevel: "aal3",
        verifiedFactor: true,
      }),
    );

    expect(aal.currentLevel).toBeNull();
    expect(aal.nextLevel).toBeNull();
  });
});

describe("needsMFAChallenge", () => {
  it("requires the challenge for an unrecognised level with a verified factor", async () => {
    await expect(
      needsMFAChallenge(
        fakeClient({
          currentLevel: "aal3",
          nextLevel: "aal2",
          verifiedFactor: true,
        }),
      ),
    ).resolves.toBe(true);
  });

  it("does not require the challenge once the session is aal2", async () => {
    await expect(
      needsMFAChallenge(
        fakeClient({
          currentLevel: "aal2",
          nextLevel: "aal2",
          verifiedFactor: true,
        }),
      ),
    ).resolves.toBe(false);
  });
});
