import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getWaitlistInviteEmail } from "@/lib/email/templates";
import { createWaitlistInvite } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

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
    const { subject, text } = getWaitlistInviteEmail({
      inviteToken: result.invite.token,
    });

    await sendEmail({
      to: result.invite.email,
      subject,
      text,
    });

    return NextResponse.json({
      success: true,
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
