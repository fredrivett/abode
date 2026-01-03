"use server";

import { tasks } from "@trigger.dev/sdk";
import db from "@/lib/db";
import { acceptInvite } from "@/lib/invites";
import { createLogger } from "@/lib/logger.server";
import type { adminNotificationTask } from "../../../trigger/admin-notification";
import type { checkGravatarTask } from "../../../trigger/check-gravatar";

const log = createLogger("auth/complete-signup");

export type CompleteSignupParams = {
  userId: string;
  email: string;
  username: string;
  inviteToken?: string;
  oauthPicture?: string | null;
};

export type CompleteSignupResult =
  | { success: true }
  | { success: false; error: string; code: string };

/**
 * Completes user signup by setting username, handling invite acceptance,
 * and triggering avatar checks.
 *
 * This function is called from:
 * - Auth callback route (when user clicks email verification link)
 * - Complete signup page (when user manually enters username)
 */
export async function completeSignup(
  params: CompleteSignupParams,
): Promise<CompleteSignupResult> {
  const { userId, email, username, inviteToken, oauthPicture } = params;

  // Track invite info for admin notification
  let signupOrigin: "user" | "waitlist" | "admin" | "direct" = "direct";
  let inviterInfo: { username: string; email: string } | undefined;

  // If we have an invite token, handle invite-based signup
  if (inviteToken) {
    const invite = await db.invite.findUnique({
      where: { token: inviteToken },
      select: {
        id: true,
        email: true,
        origin: true,
        status: true,
        inviterId: true,
        expiresAt: true,
        inviter: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!invite) {
      return {
        success: false,
        error: "Invalid invite token",
        code: "INVALID_TOKEN",
      };
    }

    // If invite was already accepted, check if it's for this email
    // (allows retry after partial signup failure)
    if (invite.status === "accepted" && invite.email !== email) {
      return {
        success: false,
        error: "This invite has already been used by another user",
        code: "INVITE_USED",
      };
    }

    // Check if expired (only matters if not already accepted)
    if (invite.status !== "accepted" && invite.expiresAt < new Date()) {
      return {
        success: false,
        error: "This invite has expired",
        code: "INVITE_EXPIRED",
      };
    }

    // Track origin for notification
    signupOrigin = invite.origin as "user" | "waitlist" | "admin";
    if (invite.origin === "user" && invite.inviter) {
      inviterInfo = {
        username: invite.inviter.username ?? "unknown",
        email: invite.inviter.email ?? "unknown",
      };
    }

    // Update user with username, origin, and referrer
    await db.user.update({
      where: { id: userId },
      data: {
        username,
        origin: invite.origin,
        referredById: invite.origin === "user" ? invite.inviterId : null,
        ...(oauthPicture && {
          avatarUrl: oauthPicture,
          avatarSource: "oauth",
        }),
      },
    });

    // Mark the invite as accepted (only if not already)
    if (invite.status !== "accepted") {
      const acceptResult = await acceptInvite(inviteToken);
      if (!acceptResult.success) {
        log.warn(
          { token: inviteToken, error: acceptResult.error },
          "Failed to accept invite after verification",
        );
      }
    }
  } else {
    // No invite - just set username (regular signup)
    await db.user.update({
      where: { id: userId },
      data: {
        username,
        ...(oauthPicture && {
          avatarUrl: oauthPicture,
          avatarSource: "oauth",
        }),
      },
    });
  }

  // Trigger Gravatar check if no OAuth avatar
  if (!oauthPicture) {
    try {
      await tasks.trigger<typeof checkGravatarTask>("check-gravatar", {
        userId,
        email,
      });
    } catch (error) {
      // Log but don't fail - Gravatar check is non-critical
      log.warn({ userId, error }, "Failed to trigger Gravatar check");
    }
  }

  log.info({ userId, username, hasInvite: !!inviteToken }, "Signup completed");

  // Trigger admin notification for account creation
  try {
    await tasks.trigger<typeof adminNotificationTask>("admin-notification", {
      type: "account_created",
      email,
      username,
      origin: signupOrigin,
      inviterUsername: inviterInfo?.username,
      inviterEmail: inviterInfo?.email,
    });
  } catch (error) {
    log.warn({ error }, "Failed to trigger admin notification for account creation");
  }

  return { success: true };
}
