import { type NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { hasFullAdminAccess } from "@/lib/admin/auth";
import { sendEmail } from "@/lib/email";
import { getWaitlistInviteEmail } from "@/lib/email/templates";
import { withViewer } from "@/lib/http/with-viewer";
import { createWaitlistInvite } from "@/lib/invites";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";
import { inviteSchema } from "./schema";

const log = createLogger("api/v1/admin/waitlist/invite");

/**
 * POST /api/v1/admin/waitlist/invite
 * Send invite to a waitlist entry (admin only)
 */
async function handlePOST(request: NextRequest) {
  try {
    // Check if user is admin
    const supabase = await createClient();
    const {
      data: { user },
    } = await getUserWithMfa(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same bar as every other admin route: admin flag plus a completed 2FA
    // challenge (AAL2), not the admin flag alone
    if (!(await hasFullAdminAccess(supabase))) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Waitlist entry ID is required" },
        { status: 400 },
      );
    }

    const { waitlistEntryId } = parsed.data;

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
  } catch (error) {
    log.error({ error }, "Waitlist invite error");
    captureServerException(error, undefined, {
      route: "POST /api/v1/admin/waitlist/invite",
    });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

export const POST = withViewer(handlePOST);
