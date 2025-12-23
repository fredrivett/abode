"use server";

import { tasks } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { acceptInvite, validateInviteToken } from "@/lib/invites";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";
import { validateUsername } from "@/lib/username";
import type { checkGravatarTask } from "../../../../trigger/check-gravatar";

const log = createLogger("auth/join/actions");

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
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        pending_username: username,
        invite_token: token,
        invite_type: invite.type,
        inviter_id: invite.inviterId,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    email,
    username,
    message: "Check your email for a confirmation code.",
  };
}

export async function verifyOtp(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const otpToken = formData.get("otpToken") as string;
  const inviteToken = formData.get("inviteToken") as string;
  const username = formData.get("username") as string;

  const { error } = await supabase.auth.verifyOtp({
    email,
    token: otpToken,
    type: "email",
  });

  if (error) {
    return { error: error.message };
  }

  // Get the user after verification
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Failed to get user after verification" };
  }

  // Get invite details for setting inviteSource and referredById
  // Note: We fetch the invite directly instead of using validateInviteToken
  // because the invite may have been accepted already (race condition with another
  // user using the same forwarded invite link). If it was accepted for THIS email,
  // we allow the flow to continue.
  const invite = await db.invite.findUnique({
    where: { token: inviteToken },
    select: {
      id: true,
      email: true,
      type: true,
      status: true,
      inviterId: true,
      expiresAt: true,
    },
  });

  if (!invite) {
    return { error: "Invalid invite token" };
  }

  // If invite was already accepted, check if it's for this email
  // (allows retry after partial signup failure)
  if (invite.status === "accepted" && invite.email !== email) {
    return { error: "This invite has already been used by another user" };
  }

  // Check if expired (only matters if not already accepted)
  if (invite.status !== "accepted" && invite.expiresAt < new Date()) {
    return { error: "This invite has expired" };
  }

  // Check for OAuth avatar in user metadata
  const userMetadata = user.user_metadata as
    | Record<string, unknown>
    | undefined;
  const oauthPicture =
    (userMetadata?.picture as string) ||
    (userMetadata?.avatar_url as string) ||
    null;

  // Map invite type to invite source
  const inviteSource = invite.type as "user" | "waitlist" | "admin";

  // Update user with username, invite source, and referrer (if user invite)
  await db.user.update({
    where: { id: user.id },
    data: {
      username,
      inviteSource,
      referredById: invite.type === "user" ? invite.inviterId : null,
      ...(oauthPicture && {
        avatarUrl: oauthPicture,
        avatarSource: "oauth" as const,
      }),
    },
  });

  // Mark the invite as accepted (only if not already)
  if (invite.status !== "accepted") {
    const acceptResult = await acceptInvite(inviteToken);
    if (!acceptResult.success) {
      // Log but don't fail - user account is already created
      log.warn(
        { token: inviteToken, error: acceptResult.error },
        "Failed to accept invite after OTP verification",
      );
    }
  }

  // No OAuth avatar - trigger background Gravatar check
  if (!oauthPicture) {
    await tasks.trigger<typeof checkGravatarTask>("check-gravatar", {
      userId: user.id,
      email,
    });
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
