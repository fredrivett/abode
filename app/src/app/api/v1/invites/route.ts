import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { getUserInviteEmail } from "@/lib/email/templates";
import {
  createUserInvite,
  getAvailableInvites,
  getUserInvites,
} from "@/lib/invites";
import { createLogger } from "@/lib/logger.server";
import { markMilestoneComplete } from "@/lib/milestones";
import { getPostHogClient } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";
import type { adminNotificationTask } from "../../../../../trigger/admin-notification";

const log = createLogger("api/v1/invites");

const sendInviteSchema = z.object({
  email: z.string().email("Invalid email address"),
});

/**
 * GET /api/v1/invites - Get current user's invite status and sent invites
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get available invites (computed) and sent invites
    const [availableInvites, invites] = await Promise.all([
      getAvailableInvites(user.id),
      getUserInvites(user.id),
    ]);

    // Format for response
    const sentInvites = invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      status: invite.effectiveStatus,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      invitesRemaining: availableInvites,
      sentInvites,
    });
  } catch (error) {
    log.error({ error }, "Failed to get invites");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/invites - Send an invite to an email address
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = sendInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid email address" },
        { status: 400 },
      );
    }

    const { email } = parsed.data;

    // Create the invite
    const result = await createUserInvite(user.id, email);

    if (!result.success) {
      // Map error codes to HTTP status codes
      const statusMap: Record<string, number> = {
        INVALID_EMAIL: 400,
        NO_INVITES_REMAINING: 400,
        ALREADY_HAS_ACCOUNT: 400,
        ALREADY_INVITED: 400,
        ALREADY_JOINED: 400,
        USER_NOT_FOUND: 404,
      };

      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: statusMap[result.code] || 400 },
      );
    }

    // Get updated available invites and inviter info for email
    const [updatedAvailableInvites, dbUser] = await Promise.all([
      getAvailableInvites(user.id),
      db.user.findUnique({
        where: { id: user.id },
        select: {
          email: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      }),
    ]);

    // Determine inviter name for email
    const inviterName =
      dbUser?.firstName && dbUser?.lastName
        ? `${dbUser.firstName} ${dbUser.lastName}`
        : dbUser?.firstName || dbUser?.username || "Someone";

    // Send invite email via Resend (if configured)
    if (isEmailConfigured()) {
      const { subject, text, html } = getUserInviteEmail({
        inviterName,
        inviteToken: result.invite.token,
      });

      const emailResult = await sendEmail({
        to: email,
        subject,
        text,
        html,
      });

      if (!emailResult.success) {
        log.error(
          { email, error: emailResult.error },
          "Failed to send invite email",
        );

        // Delete the invite since email failed - user shouldn't lose invite credit
        await db.invite.delete({
          where: { id: result.invite.id },
        }).catch((deleteError) => {
          log.error(
            { email, inviteId: result.invite.id, error: deleteError },
            "Failed to delete invite after email failure",
          );
        });

        return NextResponse.json(
          {
            error: "Failed to send invite email. Please try again. If the issue persists please reach out.",
          },
          { status: 500 },
        );
      }
    } else {
      log.info({ email }, "Email not configured, skipping invite email");
    }

    // Trigger admin notification
    try {
      await tasks.trigger<typeof adminNotificationTask>("admin-notification", {
        type: "user_invited",
        inviterEmail: dbUser?.email ?? user.email ?? "unknown",
        inviterUsername: dbUser?.username ?? "unknown",
        inviteeEmail: email,
      });
    } catch (error) {
      log.warn({ error }, "Failed to trigger admin notification for user invite");
    }

    // Track invite sent
    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "invite_sent",
      properties: {
        invites_remaining: updatedAvailableInvites,
        invite_id: result.invite.id,
      },
    });

    // Mark milestone for inviting a friend
    void markMilestoneComplete(user.id, "invite_friend");

    return NextResponse.json({
      success: true,
      invitesRemaining: updatedAvailableInvites,
      invite: {
        id: result.invite.id,
        email: result.invite.email,
        expiresAt: result.invite.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    log.error({ error }, "Failed to send invite");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
