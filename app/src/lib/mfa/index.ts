import type { Factor, SupabaseClient, User } from "@supabase/supabase-js";

export type MFAEnrollmentResult = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

const KNOWN_AALS = ["aal1", "aal2"] as const;
type KnownAal = (typeof KNOWN_AALS)[number];

export type AALInfo = {
  currentLevel: KnownAal | null;
  nextLevel: KnownAal | null;
  hasVerifiedFactor: boolean;
};

function isKnownAal(value: string | null): value is KnownAal {
  return value !== null && KNOWN_AALS.includes(value as KnownAal);
}

/**
 * Supabase types AAL as open-ended (`string & {}`) and passes the JWT claim
 * through unchecked, so anything other than aal1/aal2 is normalised to null
 */
function toKnownAal(value: string | null): KnownAal | null {
  return isKnownAal(value) ? value : null;
}

/**
 * Whether a session still owes an MFA challenge. Fails closed: with a verified
 * factor, only an explicit aal2 counts as satisfied — aal1, null, or an
 * unrecognised level all require the challenge
 */
export function isMfaChallengePending({
  currentLevel,
  hasVerifiedFactor,
}: {
  currentLevel: string | null;
  hasVerifiedFactor: boolean;
}): boolean {
  return hasVerifiedFactor && currentLevel !== "aal2";
}

export type MFAFactor = {
  id: string;
  friendlyName: string | null;
  factorType: "totp" | "phone";
  status: "unverified" | "verified";
  createdAt: string;
  updatedAt: string;
};

/**
 * Start MFA enrollment - generates QR code and secret for TOTP setup
 */
export async function enrollMFA(
  supabase: SupabaseClient,
  friendlyName?: string,
): Promise<MFAEnrollmentResult> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: friendlyName ?? "Authenticator App",
  });

  if (error) {
    throw new Error(`Failed to enroll MFA: ${error.message}`);
  }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

/**
 * Verify MFA enrollment with a TOTP code
 */
export async function verifyMFAEnrollment(
  supabase: SupabaseClient,
  factorId: string,
  code: string,
): Promise<boolean> {
  // First create a challenge
  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({
      factorId,
    });

  if (challengeError) {
    throw new Error(
      `Failed to create MFA challenge: ${challengeError.message}`,
    );
  }

  // Then verify with the code
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });

  if (verifyError) {
    throw new Error(`Failed to verify MFA: ${verifyError.message}`);
  }

  return true;
}

/**
 * Challenge and verify MFA for an already-enrolled factor (login flow)
 */
export async function challengeAndVerifyMFA(
  supabase: SupabaseClient,
  factorId: string,
  code: string,
): Promise<boolean> {
  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({
      factorId,
    });

  if (challengeError) {
    throw new Error(
      `Failed to create MFA challenge: ${challengeError.message}`,
    );
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });

  if (verifyError) {
    throw new Error(`Invalid verification code`);
  }

  return true;
}

/**
 * Get all enrolled MFA factors for the current user
 */
export async function getMFAFactors(
  supabase: SupabaseClient,
): Promise<MFAFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error) {
    throw new Error(`Failed to list MFA factors: ${error.message}`);
  }

  return data.totp.map(toMFAFactor);
}

function toMFAFactor(factor: Factor): MFAFactor {
  return {
    id: factor.id,
    friendlyName: factor.friendly_name ?? null,
    factorType: factor.factor_type as "totp" | "phone",
    status: factor.status as "unverified" | "verified",
    createdAt: factor.created_at,
    updatedAt: factor.updated_at,
  };
}

/**
 * Get the first verified TOTP factor (for login challenge). `verifiedUser` as
 * in {@link getAAL}.
 */
export async function getVerifiedTOTPFactor(
  supabase: SupabaseClient,
  verifiedUser?: User,
): Promise<MFAFactor | null> {
  const factors = verifiedUser
    ? verifiedTotpFactors(verifiedUser).map(toMFAFactor)
    : await getMFAFactors(supabase);
  return (
    factors.find((f) => f.factorType === "totp" && f.status === "verified") ??
    null
  );
}

/**
 * Unenroll (remove) an MFA factor
 */
export async function unenrollMFA(
  supabase: SupabaseClient,
  factorId: string,
): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({
    factorId,
  });

  if (error) {
    throw new Error(`Failed to unenroll MFA: ${error.message}`);
  }
}

/**
 * Get the current Authenticator Assurance Level (AAL).
 *
 * Pass `verifiedUser` when the caller already has the user the auth server
 * returned for this session (`supabase.auth.getUser()`, or the
 * `signInWithPassword` response): auth-js's `listFactors()` is another
 * `getUser()` round trip read for `user.factors`, so the factors are taken
 * from that user instead of fetched again. Never pass a user from
 * `getSession()` — it comes from the cookie, which the client can edit (an
 * emptied `factors` would skip the challenge).
 */
export async function getAAL(
  supabase: SupabaseClient,
  verifiedUser?: User,
): Promise<AALInfo> {
  // Fetch AAL and factors in parallel to reduce API calls
  const [aalResult, hasVerifiedFactor] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    verifiedUser
      ? hasVerifiedTotpFactor(verifiedUser)
      : fetchHasVerifiedTotpFactor(supabase),
  ]);

  if (aalResult.error) {
    throw new Error(`Failed to get AAL: ${aalResult.error.message}`);
  }

  return {
    currentLevel: toKnownAal(aalResult.data.currentLevel),
    nextLevel: toKnownAal(aalResult.data.nextLevel),
    hasVerifiedFactor,
  };
}

// The same set as `listFactors().data.totp`, which auth-js fills with the
// verified TOTP entries of `user.factors`
function verifiedTotpFactors(user: User): Factor[] {
  return (user.factors ?? []).filter(
    (f) => f.factor_type === "totp" && f.status === "verified",
  );
}

function hasVerifiedTotpFactor(user: User): boolean {
  return verifiedTotpFactors(user).length > 0;
}

async function fetchHasVerifiedTotpFactor(
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    throw new Error(`Failed to list MFA factors: ${error.message}`);
  }
  return data.totp.some((f) => f.status === "verified");
}

/**
 * Check if user needs to complete MFA challenge (has factor but session isn't
 * aal2). `verifiedUser` as in {@link getAAL}.
 */
export async function needsMFAChallenge(
  supabase: SupabaseClient,
  verifiedUser?: User,
): Promise<boolean> {
  return isMfaChallengePending(await getAAL(supabase, verifiedUser));
}

/**
 * Check if user has MFA enabled (has verified factor)
 */
export async function hasMFAEnabled(
  supabase: SupabaseClient,
): Promise<boolean> {
  const aal = await getAAL(supabase);
  return aal.hasVerifiedFactor;
}
