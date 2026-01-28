"use server";

import db from "@/lib/db";
import { validateInviteToken } from "@/lib/invites";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/url";
import { validateUsername } from "@/lib/username";

const log = createLogger("auth/join");

export type AuthResult = {
  error?: string;
  success?: boolean;
  message?: string;
  email?: string;
  username?: string;
};

export async function signupWithInvite(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const supabase = await createClient();

  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;

  // Validate invite token first
  const inviteResult = await validateInviteToken(token);
  if (!inviteResult.valid) {
    return { error: inviteResult.error };
  }

  const { invite } = inviteResult;
  const email = invite.email;

  // Validate username
  const validation = validateUsername(username);
  if (!validation.valid) {
    return { error: validation.error };
  }

  // Check username availability (case-insensitive)
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

  // Store invite info in user metadata for retrieval after OTP
  const redirectUrl = `${getAppBaseUrl()}/auth/confirm`;
  log.info(
    {
      email,
      username,
      inviteToken: `${token.substring(0, 8)}...`,
      inviteOrigin: invite.origin,
      redirectUrl,
    },
    "Attempting signup with invite metadata",
  );
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        pending_username: username,
        invite_token: token,
        invite_origin: invite.origin,
        inviter_id: invite.inviterId,
      },
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    log.error({ email, error: error.message }, "Signup with invite failed");
    return { error: error.message };
  }

  log.info(
    {
      email,
      username,
      userId: data.user?.id,
      metadataKeys: data.user?.user_metadata ? Object.keys(data.user.user_metadata) : [],
      metadata: data.user?.user_metadata,
    },
    "Signup with invite successful - metadata stored",
  );

  return {
    success: true,
    email,
    username,
    message: "Check your email for a verification link.",
  };
}
