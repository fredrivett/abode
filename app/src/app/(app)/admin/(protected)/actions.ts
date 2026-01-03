"use server";

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { tasks } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { hasFullAdminAccess } from "@/lib/admin/auth";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
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

    // Delete avatar files from Supabase Storage
    const { data: avatarFiles } = await supabaseAdmin.storage
      .from("avatars")
      .list(userId);

    if (avatarFiles && avatarFiles.length > 0) {
      const filesToDelete = avatarFiles.map((f) => `${userId}/${f.name}`);
      await supabaseAdmin.storage.from("avatars").remove(filesToDelete);
    }

    // Delete item files from Supabase Storage
    const { data: itemFiles } = await supabaseAdmin.storage
      .from("items")
      .list(userId);

    if (itemFiles && itemFiles.length > 0) {
      const filesToDelete = itemFiles.map((f) => `${userId}/${f.name}`);
      await supabaseAdmin.storage.from("items").remove(filesToDelete);
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
      log.warn({ error: notifyError }, "Failed to trigger admin notification for account deletion");
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
