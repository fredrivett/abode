import { createClient } from "@supabase/supabase-js";
import { generateTotp } from "./totp";
import { createUser, type TestUser } from "./user";

/**
 * Create a confirmed user with a verified TOTP factor enrolled.
 *
 * Signs in as the user to enroll + verify a factor (generating the codes
 * locally via TOTP), then signs that helper session out so the browser starts
 * clean. After a UI password sign-in the user is left at aal1 (MFA pending).
 */
export async function createUserWithMfa(opts: {
  email: string;
  username: string;
}): Promise<{ user: TestUser; totpSecret: string }> {
  const user = await createUser(opts);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars",
    );
  }

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (signInError) {
    throw new Error(`MFA setup sign-in failed: ${signInError.message}`);
  }

  const { data: enroll, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "e2e-authenticator",
  });
  if (enrollError || !enroll) {
    throw new Error(`MFA enroll failed: ${enrollError?.message}`);
  }

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: enroll.id });
  if (challengeError || !challenge) {
    throw new Error(`MFA challenge failed: ${challengeError?.message}`);
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: enroll.id,
    challengeId: challenge.id,
    code: generateTotp(enroll.totp.secret),
  });
  if (verifyError) {
    throw new Error(`MFA verify failed: ${verifyError.message}`);
  }

  await supabase.auth.signOut();
  return { user, totpSecret: enroll.totp.secret };
}
