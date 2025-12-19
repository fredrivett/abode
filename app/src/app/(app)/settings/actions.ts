"use server";

import { revalidatePath } from "next/cache";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { MAX_USERNAME_CHANGES, validateUsername } from "@/lib/username";

type PreviousUsername = {
  username: string;
  changedAt: string;
};

export type ChangeUsernameResult = {
  error?: string;
  success?: boolean;
};

export async function changeUsername(
  _prevState: ChangeUsernameResult,
  formData: FormData,
): Promise<ChangeUsernameResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const newUsername = formData.get("username") as string;

  // Validate format
  const validation = validateUsername(newUsername);
  if (!validation.valid) {
    return { error: validation.error };
  }

  // Get current user data
  const currentUser = await db.user.findUnique({
    where: { id: user.id },
    select: { username: true, previousUsernames: true },
  });

  if (!currentUser) {
    return { error: "User not found" };
  }

  // Check if it's the same username
  if (currentUser.username?.toLowerCase() === newUsername.toLowerCase()) {
    return { error: "This is already your username" };
  }

  // Check change limit
  const previousUsernames =
    (currentUser.previousUsernames as PreviousUsername[]) || [];
  if (previousUsernames.length >= MAX_USERNAME_CHANGES) {
    return { error: "Maximum username changes reached" };
  }

  // Check availability (case-insensitive, excluding current user)
  const existing = await db.user.findFirst({
    where: {
      username: {
        equals: newUsername,
        mode: "insensitive",
      },
      id: { not: user.id },
    },
    select: { id: true },
  });

  if (existing) {
    return { error: "Username is already taken" };
  }

  // Build updated previous usernames array
  const updatedPreviousUsernames: PreviousUsername[] = [...previousUsernames];
  if (currentUser.username) {
    updatedPreviousUsernames.push({
      username: currentUser.username,
      changedAt: new Date().toISOString(),
    });
  }

  // Update username
  await db.user.update({
    where: { id: user.id },
    data: {
      username: newUsername,
      previousUsernames: updatedPreviousUsernames,
    },
  });

  revalidatePath("/settings");
  return { success: true };
}
