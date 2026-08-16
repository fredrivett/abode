import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger.server";
import { revokePersonalAccessToken } from "@/lib/personal-access-tokens";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/tokens/[id]");

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * DELETE /api/v1/tokens/:id - Revoke a personal access token
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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
