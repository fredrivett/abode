"use server";

import { tasks } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import db from "@/lib/db";
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
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { pending_username: username },
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
  const token = formData.get("token") as string;
  const username = formData.get("username") as string;

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return { error: error.message };
  }

  // Get the user after verification
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && username) {
    // Check for OAuth avatar in user metadata
    const userMetadata = user.user_metadata as
      | Record<string, unknown>
      | undefined;
    const oauthPicture =
      (userMetadata?.picture as string) ||
      (userMetadata?.avatar_url as string) ||
      null;

    // Set username (and OAuth avatar if present) in a single update
    await db.user.update({
      where: { id: user.id },
      data: {
        username,
        ...(oauthPicture && {
          avatarUrl: oauthPicture,
          avatarSource: "oauth" as const,
        }),
      },
    });

    // No OAuth avatar - trigger background Gravatar check
    if (!oauthPicture) {
      await tasks.trigger<typeof checkGravatarTask>("check-gravatar", {
        userId: user.id,
        email,
      });
    }
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
