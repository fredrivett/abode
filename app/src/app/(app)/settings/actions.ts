"use server";

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { tasks } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import db from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getUserAccountDeletionEmail } from "@/lib/email/templates";
import { validateEmail } from "@/lib/invites/email-validation";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_USERNAME_CHANGES,
  type PreviousUsername,
  validateUsername,
} from "@/lib/username";
import type { adminNotificationTask } from "../../../../trigger/admin-notification";

const log = createLogger("settings/actions");

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

  // Track username change
  const posthog = getPostHogClient();
  posthog?.capture({
    distinctId: user.id,
    event: "username_changed",
    properties: {
      is_case_only_change: isCaseOnlyChange,
      previous_username_count: previousUsernames.length,
    },
  });

  revalidatePath("/settings");
  return { success: true };
}

export type DeleteAccountResult = {
  error?: string;
  success?: boolean;
};

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables for admin client");
  }

  return createSupabaseAdmin(url, key);
}

export async function deleteAccount(
  _prevState: DeleteAccountResult,
  formData: FormData,
): Promise<DeleteAccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const password = formData.get("password") as string;

  if (!password) {
    return { error: "Password is required" };
  }

  if (!user.email) {
    return { error: "User email not found" };
  }

  // Verify password by attempting to sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (signInError) {
    return { error: "Incorrect password" };
  }

  // Get user info for notification before deletion
  const userToDelete = await db.user.findUnique({
    where: { id: user.id },
    select: { email: true, username: true },
  });

  const supabaseAdmin = getSupabaseAdminClient();

  try {
    // Delete all user's items first (CASCADE will handle locations, vectors, details, room items)
    await db.item.deleteMany({
      where: { userId: user.id },
    });

    // Delete all user's rooms
    await db.room.deleteMany({
      where: { userId: user.id },
    });

    // Delete the user record from the database
    await db.user.delete({
      where: { id: user.id },
    });

    // Delete avatar files from Supabase Storage
    const { data: avatarFiles } = await supabaseAdmin.storage
      .from("avatars")
      .list(user.id);

    if (avatarFiles && avatarFiles.length > 0) {
      const filesToDelete = avatarFiles.map((f) => `${user.id}/${f.name}`);
      await supabaseAdmin.storage.from("avatars").remove(filesToDelete);
    }

    // Delete item files from Supabase Storage
    const { data: itemFiles } = await supabaseAdmin.storage
      .from("items")
      .list(user.id);

    if (itemFiles && itemFiles.length > 0) {
      const filesToDelete = itemFiles.map((f) => `${user.id}/${f.name}`);
      await supabaseAdmin.storage.from("items").remove(filesToDelete);
    }

    // Delete the Supabase auth user
    const { error: deleteAuthError } =
      await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteAuthError) {
      log.error(
        { error: deleteAuthError, userId: user.id },
        "Failed to delete auth user",
      );
    }

    // Track account deletion event with PostHog (churn event)
    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "account_deleted",
      properties: {
        deleted_by: "self",
      },
    });

    // Send confirmation email to user before signing them out
    try {
      const { subject, text, html } = getUserAccountDeletionEmail();
      await sendEmail({
        to: user.email,
        subject,
        text,
        html,
      });
    } catch (emailError) {
      log.warn(
        { error: emailError },
        "Failed to send account deletion email to user",
      );
    }

    // Trigger admin notification for account deletion
    try {
      await tasks.trigger<typeof adminNotificationTask>("admin-notification", {
        type: "account_deleted",
        email: userToDelete?.email ?? user.email ?? "unknown",
        username: userToDelete?.username ?? "unknown",
        deletedBy: "self",
      });
    } catch (notifyError) {
      log.warn(
        { error: notifyError },
        "Failed to trigger admin notification for account deletion",
      );
    }

    // Sign out the user
    await supabase.auth.signOut();
  } catch (error) {
    log.error({ error, userId: user.id }, "Account deletion error");
    captureServerException(error, user.id, { action: "deleteAccount" });
    return { error: "Failed to delete account. Please try again." };
  }

  redirect("/?account-deleted=true");
}

export type RequestEmailChangeResult = {
  error?: string;
  success?: boolean;
};

export async function requestEmailChange(
  _prevState: RequestEmailChangeResult,
  formData: FormData,
): Promise<RequestEmailChangeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const emailValue = formData.get("email");
  if (typeof emailValue !== "string" || !emailValue) {
    return { error: "Email is required" };
  }
  const newEmail = emailValue;

  // Validate email format and check for disposable domains
  const validation = validateEmail(newEmail);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const normalizedEmail = newEmail.trim().toLowerCase();

  // Check if same as current email
  if (normalizedEmail === user.email?.toLowerCase()) {
    return { error: "This is already your email address" };
  }

  // Check if email is already in use by another user
  const existingUser = await db.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: "insensitive" },
      id: { not: user.id },
    },
    select: { id: true },
  });

  if (existingUser) {
    return { error: "This email is already in use" };
  }

  // Request email change via Supabase (triggers verification emails to both addresses)
  const { error } = await supabase.auth.updateUser({
    email: normalizedEmail,
  });

  if (error) {
    log.error({ error, userId: user.id }, "Failed to request email change");
    captureServerException(error, user.id, {
      action: "requestEmailChange",
    });
    return { error: error.message };
  }

  // Track event
  const posthog = getPostHogClient();
  posthog?.capture({
    distinctId: user.id,
    event: "email_change_requested",
    properties: {
      new_email_domain: normalizedEmail.split("@")[1],
    },
  });

  // Log activity
  void logActivity(user.id, "user_update", {
    action: "email_change_requested",
  });

  return { success: true };
}
