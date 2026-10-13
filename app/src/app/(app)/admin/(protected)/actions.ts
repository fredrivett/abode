"use server";

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { tasks } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { hasFullAdminAccess } from "@/lib/admin/auth";
import {
  MAX_INVITE_ALLOCATION,
  parseInviteAllocation,
} from "@/lib/admin/invite-allocation";
import { reprocessIssueGroup } from "@/lib/admin/reprocess-issues";
import db from "@/lib/db";
import { getInviteUsage, type InviteUsage } from "@/lib/invites";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { removeUserStorage } from "@/lib/storage-objects";
import { createClient } from "@/lib/supabase/server";
import type { adminNotificationTask } from "../../../../../trigger/admin-notification";

const log = createLogger("admin/actions");

export type DeleteUserResult = {
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

/**
 * Server action that deletes a user by ID, including all their items, rooms, files, and auth record.
 * Requires admin access with MFA at aal2. Logs activity audit trail and triggers admin notification.
 */
export async function deleteUserAsAdmin(
  userId: string,
): Promise<DeleteUserResult> {
  const supabase = await createClient();

  // Verify admin access (with MFA at aal2)
  const isAdmin = await hasFullAdminAccess(supabase);
  if (!isAdmin) {
    return { error: "Unauthorized: Admin access required" };
  }

  // Get current admin user
  const {
    data: { user: adminUser },
  } = await supabase.auth.getUser();

  if (!adminUser) {
    return { error: "Unauthorized" };
  }

  // Prevent admin from deleting themselves
  if (adminUser.id === userId) {
    return { error: "You cannot delete your own account from the admin panel" };
  }

  // Verify the user exists
  const userToDelete = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true },
  });

  if (!userToDelete) {
    return { error: "User not found" };
  }

  const supabaseAdmin = getSupabaseAdminClient();

  try {
    // Delete all user's items first (CASCADE will handle locations, vectors, details, room items)
    await db.item.deleteMany({
      where: { userId },
    });

    // Delete all user's rooms
    await db.room.deleteMany({
      where: { userId },
    });

    // Delete the user record from the database
    await db.user.delete({
      where: { id: userId },
    });

    // Delete every stored file (item files + avatars), paging past list()'s
    // default 100 so large libraries don't leave files behind
    const storage = await removeUserStorage(supabaseAdmin, userId);
    for (const { bucket, error } of storage.failures) {
      log.error(
        { error, userId: userId, bucket, adminId: adminUser.id },
        "Failed to delete user storage",
      );
      captureServerException(error, userId, {
        bucket,
        context: "account_deletion",
      });
    }

    // Delete the Supabase auth user
    const { error: deleteAuthError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      log.error(
        { error: deleteAuthError, userId, adminId: adminUser.id },
        "Failed to delete auth user",
      );
    }

    // Log admin action to database for audit trail
    await logActivity(adminUser.id, "admin_delete_user", {
      deletedUserId: userId,
      deletedUserEmail: userToDelete.email,
      deletedUserUsername: userToDelete.username,
    });

    log.info(
      {
        deletedUserId: userId,
        deletedUserEmail: userToDelete.email,
        deletedUserUsername: userToDelete.username,
        adminId: adminUser.id,
      },
      "Admin deleted user",
    );

    // Trigger admin notification for account deletion
    try {
      await tasks.trigger<typeof adminNotificationTask>("admin-notification", {
        type: "account_deleted",
        email: userToDelete.email ?? "unknown",
        username: userToDelete.username ?? "unknown",
        deletedBy: "admin",
        adminEmail: adminUser.email,
      });
    } catch (notifyError) {
      log.warn(
        { error: notifyError },
        "Failed to trigger admin notification for account deletion",
      );
    }

    revalidatePath("/admin/users");
  } catch (error) {
    log.error(
      { error, userId, adminId: adminUser.id },
      "Admin user deletion error",
    );
    return { error: "Failed to delete user. Please try again." };
  }

  redirect("/admin/users");
}

export type ReprocessGroupResult = {
  error?: string;
  triggered?: number;
  monitorUrl?: string | null;
};

/**
 * Re-run the capture pipeline for the current members of a processing-issue
 * group (failed / stuck / missing-*). Admin + MFA gated. Bounded, low-priority,
 * and routed through the existing tasks — see {@link reprocessIssueGroup}.
 */
export async function reprocessIssueGroupAsAdmin(
  groupKey: string,
): Promise<ReprocessGroupResult> {
  const supabase = await createClient();
  const isAdmin = await hasFullAdminAccess(supabase);
  if (!isAdmin) return { error: "Unauthorized: Admin access required" };

  try {
    const result = await reprocessIssueGroup(groupKey);
    log.info({ groupKey, ...result }, "Admin reprocessed issue group");
    revalidatePath("/admin/processing");
    return result;
  } catch (error) {
    log.error({ error, groupKey }, "Failed to reprocess issue group");
    return { error: "Failed to reprocess. Please try again." };
  }
}

export type SetInviteAllocationResult =
  | { error: string }
  | { success: true; usage: InviteUsage };

/**
 * Set how many invites a user has (their total allocation, used + available).
 * Admin + MFA gated. Lowering it below what's already used just leaves them
 * with none available; sent invites are untouched.
 */
export async function setInviteAllocationAsAdmin({
  userId,
  allocation,
}: {
  userId: string;
  allocation: number;
}): Promise<SetInviteAllocationResult> {
  const supabase = await createClient();
  const isAdmin = await hasFullAdminAccess(supabase);
  if (!isAdmin) return { error: "Unauthorized: Admin access required" };

  const value = parseInviteAllocation(allocation);
  if (value === null) {
    return {
      error: `Enter a whole number from 0 to ${MAX_INVITE_ALLOCATION}`,
    };
  }

  try {
    // Read usage before writing, so a successful update never reports failure
    // because a follow-up read failed
    const before = await getInviteUsage(userId);
    if (!before) return { error: "User not found" };

    await db.user.update({
      where: { id: userId },
      data: { inviteAllocation: value },
    });
    log.info(
      { userId, from: before.allocation, to: value },
      "Admin set invite allocation",
    );

    const usage: InviteUsage = {
      allocation: value,
      used: before.used,
      available: Math.max(0, value - before.used),
    };
    revalidatePath(`/admin/users/${userId}`);
    return { success: true, usage };
  } catch (error) {
    log.error({ error, userId }, "Failed to set invite allocation");
    captureServerException(error, undefined, {
      action: "setInviteAllocationAsAdmin",
    });
    return { error: "Failed to update invites. Please try again." };
  }
}
