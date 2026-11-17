import { type NextRequest, NextResponse } from "next/server";
import type { Principal } from "@/lib/auth/authenticate-request";
import { authedRoute } from "@/lib/http/authed-route";
import { createLogger } from "@/lib/logger.server";
import { revokePersonalAccessToken } from "@/lib/personal-access-tokens";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";

const log = createLogger("api/v1/tokens/[id]");

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * DELETE /api/v1/tokens/:id - Revoke a personal access token
 */
async function handleDELETE(
  _request: NextRequest,
  { params, principal }: RouteParams & { principal: Principal },
) {
  try {
    const { id } = await params;
    const { user } = principal;

    const result = await revokePersonalAccessToken(id, user.id);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: 404 },
      );
    }

    getPostHogClient()?.capture({
      distinctId: user.id,
      event: "token_revoked",
      properties: { token_id: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ error }, "Failed to revoke token");
    captureServerException(error, undefined, {
      route: "DELETE /api/v1/tokens/[id]",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export const DELETE = authedRoute({ credentials: "session" }, handleDELETE);
