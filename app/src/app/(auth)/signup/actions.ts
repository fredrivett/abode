"use server";

import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/url";
import { validateUsername } from "@/lib/username";

const log = createLogger("auth/signup");

export type AuthResult = {
  error?: string;
  success?: boolean;
  message?: string;
  email?: string;
  username?: string;
};

export async function signup(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;

  // Validate username
  const validation = validateUsername(username);
  if (!validation.valid) {
    return { error: validation.error };
  }

  // Check availability (case-insensitive)
  const existing = await db.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existing) {
    return { error: "Username is already taken" };
  }

  // Store username in Supabase user metadata for retrieval after OTP
  const redirectUrl = `${getAppBaseUrl()}/auth/confirm`;
  log.info({ email, username, redirectUrl }, "Attempting signup with pending_username in metadata");
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { pending_username: username },
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    log.error({ email, error: error.message }, "Signup failed");
    return { error: error.message };
  }

  log.info(
    {
      email,
      username,
      userId: data.user?.id,
      metadataKeys: data.user?.user_metadata ? Object.keys(data.user.user_metadata) : [],
    },
    "Signup successful - metadata stored",
  );

  return {
    success: true,
    email,
    username,
    message: "Check your email for a verification link.",
  };
}
