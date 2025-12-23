import { type NextRequest, NextResponse } from "next/server";
import { getAvailableInvites, revokeInvite } from "@/lib/invites";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/invites/[id]");

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * DELETE /api/v1/invites/:id - Revoke an invite
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Revoke the invite
    const result = await revokeInvite(id, user.id);

    if (!result.success) {
      // Map error codes to HTTP status codes
      const statusMap: Record<string, number> = {
        INVITE_NOT_FOUND: 404,
        UNAUTHORIZED: 403,
        ALREADY_ACCEPTED: 400,
      };

      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: statusMap[result.code] || 400 },
      );
    }

    // Get updated available invites count
    const invitesRemaining = await getAvailableInvites(user.id);

    return NextResponse.json({
      success: true,
      invitesRemaining,
    });
  } catch (error) {
    log.error({ error }, "Failed to revoke invite");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
