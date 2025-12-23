import { type NextRequest, NextResponse } from "next/server";
import { validateInviteToken } from "@/lib/invites";
import { createLogger } from "@/lib/logger.server";

const log = createLogger("api/v1/invites/validate");

/**
 * GET /api/v1/invites/validate?token=xxx - Validate an invite token (public endpoint)
 *
 * Returns invite details if valid, including origin and inviter info (if user invite)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 },
      );
    }

    const result = await validateInviteToken(token);

    if (!result.valid) {
      // Map error codes to HTTP status codes
      const statusMap: Record<string, number> = {
        INVALID_TOKEN: 404,
        EXPIRED: 410,
        ALREADY_ACCEPTED: 410,
      };

      return NextResponse.json(
        { valid: false, error: result.error, code: result.code },
        { status: statusMap[result.code] || 400 },
      );
    }

    const { invite } = result;

    // Build response based on invite origin
    const response: Record<string, unknown> = {
      valid: true,
      email: invite.email,
      origin: invite.origin,
    };

    // Only include inviter info for user invites
    if (invite.origin === "user" && invite.inviter) {
      response.inviterUsername = invite.inviter.username;
      response.inviterDisplayName =
        invite.inviter.firstName && invite.inviter.lastName
          ? `${invite.inviter.firstName} ${invite.inviter.lastName}`
          : invite.inviter.firstName || invite.inviter.username;
    }

    return NextResponse.json(response);
  } catch (error) {
    log.error({ error }, "Failed to validate invite");
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
