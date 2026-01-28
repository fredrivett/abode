import type { SupabaseClient } from "@supabase/supabase-js";
import db from "@/lib/db";
import { getAAL } from "@/lib/mfa";

export type AdminAccessResult = {
  isAdmin: boolean;
  hasMFA: boolean;
  isAAL2: boolean;
  userId: string | null;
};

/**
 * Check admin access for the current user.
 * Returns details about admin status, MFA enrollment, and current AAL level.
 */
export async function checkAdminAccess(
  supabase: SupabaseClient,
): Promise<AdminAccessResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      isAdmin: false,
      hasMFA: false,
      isAAL2: false,
      userId: null,
    };
  }

  // Check if user is admin in database
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    return {
      isAdmin: false,
      hasMFA: false,
      isAAL2: false,
      userId: user.id,
    };
  }

  // Check MFA status
  const aal = await getAAL(supabase);

  return {
    isAdmin: true,
    hasMFA: aal.hasVerifiedFactor,
    isAAL2: aal.currentLevel === "aal2",
    userId: user.id,
  };
}

/**
 * Check if current user has full admin access (admin + MFA at aal2).
 * Use this for protecting admin routes and API endpoints.
 */
export async function hasFullAdminAccess(
  supabase: SupabaseClient,
): Promise<boolean> {
  const access = await checkAdminAccess(supabase);
  return access.isAdmin && access.hasMFA && access.isAAL2;
}

/**
 * Get all admin user emails.
 * Use this for sending notifications to all admins.
 */
export async function getAllAdminEmails(): Promise<string[]> {
  const admins = await db.user.findMany({
    where: { isAdmin: true },
    select: { email: true },
  });

  return admins.map((admin) => admin.email);
}
