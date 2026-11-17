import { type NextRequest, NextResponse } from "next/server";
import type { Principal } from "@/lib/auth/authenticate-request";
import { authedRoute } from "@/lib/http/authed-route";
import { getAvailableInvites, revokeInvite } from "@/lib/invites";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("api/v1/invites/[id]");

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * DELETE /api/v1/invites/:id - Revoke an invite
 */
async function handleDELETE(
  _request: NextRequest,
  { params, principal }: RouteParams & { principal: Principal },
) {
  try {
    const { id } = await params;
    const { user } = principal;

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
    captureServerException(error, undefined, {
      route: "DELETE /api/v1/invites/[id]",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export const DELETE = authedRoute({ credentials: "session" }, handleDELETE);
