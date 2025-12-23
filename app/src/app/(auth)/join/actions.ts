"use server";

import { tasks } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { acceptInvite, validateInviteToken } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";
import { validateUsername } from "@/lib/username";
import type { checkGravatarTask } from "../../../../trigger/check-gravatar";

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
  const inviteResult = await validateInviteToken(inviteToken);
  if (!inviteResult.valid) {
    return { error: "Invalid invite token" };
  }

  const { invite } = inviteResult;

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

  // Mark the invite as accepted
  await acceptInvite(inviteToken);

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
