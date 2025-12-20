"use server";

import { revalidatePath } from "next/cache";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_USERNAME_CHANGES,
  type PreviousUsername,
  validateUsername,
} from "@/lib/username";

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

  // Check if it's exactly the same username (no change at all)
  if (currentUser.username === newUsername) {
    return { error: "This is already your username" };
  }

  // Check if it's only a case change (e.g., "Fred" -> "FRED")
  const isCaseOnlyChange =
    currentUser.username?.toLowerCase() === newUsername.toLowerCase();

  const previousUsernames =
    (currentUser.previousUsernames as PreviousUsername[]) || [];

  // Only check change limit for non-case-only changes
  if (!isCaseOnlyChange && previousUsernames.length >= MAX_USERNAME_CHANGES) {
    return { error: "Maximum username changes reached" };
  }

  // Check availability (case-insensitive, excluding current user)
  // For case-only changes, this will find no conflicts since we exclude current user
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

  // Build updated previous usernames array (only for non-case-only changes)
  const updatedPreviousUsernames: PreviousUsername[] = [...previousUsernames];
  if (!isCaseOnlyChange && currentUser.username) {
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
