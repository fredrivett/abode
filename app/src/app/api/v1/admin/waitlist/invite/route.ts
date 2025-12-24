import { type NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import db from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getWaitlistInviteEmail } from "@/lib/email/templates";
import { createWaitlistInvite } from "@/lib/invites";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/admin/waitlist/invite");

/**
 * POST /api/v1/admin/waitlist/invite
 * Send invite to a waitlist entry (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true },
    });

    if (!dbUser?.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { waitlistEntryId } = body as { waitlistEntryId?: string };

    if (!waitlistEntryId || typeof waitlistEntryId !== "string") {
      return NextResponse.json(
        { error: "Waitlist entry ID is required" },
        { status: 400 },
      );
    }

    const result = await createWaitlistInvite(waitlistEntryId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Send invite email
    const { subject, text, html } = getWaitlistInviteEmail({
      inviteToken: result.invite.token,
    });

    const emailResult = await sendEmail({
      to: result.invite.email,
      subject,
      text,
      html,
    });

    if (!emailResult.success) {
      log.warn(
        { email: result.invite.email, error: emailResult.error },
        "Failed to send waitlist invite email",
      );
    }

    // Log admin action to database for audit trail
    await logActivity(user.id, "admin_invite_waitlist", {
      inviteId: result.invite.id,
      inviteeEmail: result.invite.email,
      waitlistEntryId,
      emailSent: emailResult.success,
    });

    return NextResponse.json({
      success: true,
      emailSent: emailResult.success,
      emailError: emailResult.success ? undefined : emailResult.error,
      invite: {
        id: result.invite.id,
        email: result.invite.email,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
