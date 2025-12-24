"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { completeSignup } from "@/lib/auth/complete-signup";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { validateUsername } from "@/lib/username";

export type CompleteProfileResult = {
  error?: string;
  success?: boolean;
};

export async function completeProfile(
  _prevState: CompleteProfileResult,
  formData: FormData,
): Promise<CompleteProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: "Not authenticated" };
  }

  const username = formData.get("username") as string;
  const inviteToken = formData.get("inviteToken") as string;

  // Validate username
  const validation = validateUsername(username);
  if (!validation.valid) {
    return { error: validation.error };
  }

  // Check username availability
  const existing = await db.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      id: { not: user.id }, // Exclude current user
    },
    select: { id: true },
  });

  if (existing) {
    return { error: "Username is already taken" };
  }

  // Complete signup with or without invite
  const result = await completeSignup({
    userId: user.id,
    email: user.email,
    username,
    inviteToken: inviteToken || undefined,
  });

  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
