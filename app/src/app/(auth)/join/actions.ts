"use server";

import db from "@/lib/db";
import { validateInviteToken } from "@/lib/invites";
import { createLogger } from "@/lib/logger.server";
import { isCanonicalUuid } from "@/lib/pagination";
import { getPostHogClient } from "@/lib/posthog-server";
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
  // Shared item to save once signup completes (from a share invite)
  const save = formData.get("save");
  const saveItemId =
    typeof save === "string" && isCanonicalUuid(save) ? save : null;

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
  log.info(
    {
      email,
      username,
      inviteToken: `${token.substring(0, 8)}...`,
      inviteOrigin: invite.origin,
    },
    "Attempting signup with invite metadata",
  );
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getAppBaseUrl()}/auth/confirm`,
      data: {
        pending_username: username,
        invite_token: token,
        invite_origin: invite.origin,
        inviter_id: invite.inviterId,
        ...(saveItemId && { save_item_id: saveItemId }),
      },
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
      metadataKeys: data.user?.user_metadata
        ? Object.keys(data.user.user_metadata)
        : [],
      metadata: data.user?.user_metadata,
    },
    "Signup with invite successful - metadata stored",
  );

  // Supabase answers an already-registered email with a placeholder user that
  // has no identities; only a real new account starts the signup funnel
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    getPostHogClient()?.capture({
      distinctId: data.user.id,
      event: "signup_started",
      properties: {
        invite_origin: invite.origin,
        has_save_item: saveItemId !== null,
      },
    });
  }

  return {
    success: true,
    email,
    username,
    message: "Check your email for a verification link.",
  };
}
