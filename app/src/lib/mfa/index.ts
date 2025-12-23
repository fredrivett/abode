import type { SupabaseClient } from "@supabase/supabase-js";

export type MFAEnrollmentResult = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

export type AALInfo = {
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  hasVerifiedFactor: boolean;
};

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

  return data.totp.map((factor) => ({
    id: factor.id,
    friendlyName: factor.friendly_name ?? null,
    factorType: factor.factor_type as "totp" | "phone",
    status: factor.status as "unverified" | "verified",
    createdAt: factor.created_at,
    updatedAt: factor.updated_at,
  }));
}

/**
 * Get the first verified TOTP factor (for login challenge)
 */
export async function getVerifiedTOTPFactor(
  supabase: SupabaseClient,
): Promise<MFAFactor | null> {
  const factors = await getMFAFactors(supabase);
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
 * Get the current Authenticator Assurance Level (AAL)
 */
export async function getAAL(supabase: SupabaseClient): Promise<AALInfo> {
  // Fetch AAL and factors in parallel to reduce API calls
  const [aalResult, factorsResult] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);

  if (aalResult.error) {
    throw new Error(`Failed to get AAL: ${aalResult.error.message}`);
  }

  if (factorsResult.error) {
    throw new Error(
      `Failed to list MFA factors: ${factorsResult.error.message}`,
    );
  }

  // Check if user has any verified factors
  const hasVerifiedFactor = factorsResult.data.totp.some(
    (f) => f.status === "verified",
  );

  return {
    currentLevel: aalResult.data.currentLevel,
    nextLevel: aalResult.data.nextLevel,
    hasVerifiedFactor,
  };
}

/**
 * Check if user needs to complete MFA challenge (has factor but current AAL is aal1)
 */
export async function needsMFAChallenge(
  supabase: SupabaseClient,
): Promise<boolean> {
  const aal = await getAAL(supabase);
  return aal.hasVerifiedFactor && aal.currentLevel === "aal1";
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
