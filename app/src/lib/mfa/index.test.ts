import type { SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  getAAL,
  getVerifiedTOTPFactor,
  isMfaChallengePending,
  needsMFAChallenge,
} from "./index";

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
  ])(
    "currentLevel=$currentLevel, factor=$hasVerifiedFactor → $expected",
    ({ currentLevel, hasVerifiedFactor, expected }) => {
      expect(isMfaChallengePending({ currentLevel, hasVerifiedFactor })).toBe(
        expected,
      );
    },
  );
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

  it.each([
    // listFactors().data.totp holds only verified TOTP factors, so these match it
    { factors: [{ factor_type: "totp", status: "verified" }], expected: true },
    {
      factors: [
        { factor_type: "totp", status: "unverified" },
        { factor_type: "phone", status: "verified" },
      ],
      expected: false,
    },
    { factors: undefined, expected: false },
  ])(
    "reads a verified user's factors without listing them: $factors → $expected",
    async ({ factors, expected }) => {
      const supabase = fakeClient({
        currentLevel: "aal1",
        nextLevel: "aal1",
        // The listing disagrees, so a fallback to it fails the assertion
        verifiedFactor: !expected,
      });
      const listFactors = vi.spyOn(supabase.auth.mfa, "listFactors");

      const aal = await getAAL(supabase, {
        id: "u1",
        factors,
      } as unknown as User);

      expect(aal.hasVerifiedFactor).toBe(expected);
      expect(listFactors).not.toHaveBeenCalled();
    },
  );

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

describe("getVerifiedTOTPFactor", () => {
  it("picks a verified user's verified TOTP factor without listing them", async () => {
    const supabase = fakeClient({
      currentLevel: "aal1",
      nextLevel: "aal2",
      verifiedFactor: true,
    });
    const listFactors = vi.spyOn(supabase.auth.mfa, "listFactors");
    const user = {
      id: "u1",
      factors: [
        { id: "f-pending", factor_type: "totp", status: "unverified" },
        { id: "f-phone", factor_type: "phone", status: "verified" },
        { id: "f-totp", factor_type: "totp", status: "verified" },
      ],
    } as unknown as User;

    const factor = await getVerifiedTOTPFactor(supabase, user);

    expect(factor?.id).toBe("f-totp");
    expect(listFactors).not.toHaveBeenCalled();
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
