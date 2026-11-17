import type { MilestoneType } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Principal } from "@/lib/auth/authenticate-request";
import { authedRoute } from "@/lib/http/authed-route";
import { zodErrorResponse } from "@/lib/http/zod-error";
import { createLogger } from "@/lib/logger.server";
import {
  getMilestoneStatus,
  MILESTONE_CONFIG,
  MILESTONE_TYPES,
  markMilestoneComplete,
} from "@/lib/milestones";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("api/v1/user/milestones");

/**
 * GET /api/v1/user/milestones
 * Returns the user's milestone status
 */
async function handleGET(
  _request: NextRequest,
  { principal }: { principal: Principal },
) {
  try {
    const { user } = principal;

    const status = await getMilestoneStatus(user.id);

    return NextResponse.json({
      completed: status.completed.map((m) => ({
        type: m.type,
        completedAt: m.completedAt.toISOString(),
      })),
      pending: status.pending,
      hasArticle: status.hasArticle,
      config: MILESTONE_CONFIG,
    });
  } catch (error) {
    log.error({ error }, "Failed to get milestone status");
    captureServerException(error, undefined, {
      route: "GET /api/v1/user/milestones",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

const markCompleteSchema = z.object({
  type: z.enum(MILESTONE_TYPES as [MilestoneType, ...MilestoneType[]]),
});

/**
 * POST /api/v1/user/milestones
 * Marks a milestone as complete
 */
async function handlePOST(
  request: NextRequest,
  { principal }: { principal: Principal },
) {
  try {
    const { user } = principal;

    const body = await request.json().catch(() => ({}));
    const parsed = markCompleteSchema.safeParse(body);

    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    await markMilestoneComplete(user.id, parsed.data.type);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ error }, "Failed to mark milestone complete");
    captureServerException(error, undefined, {
      route: "POST /api/v1/user/milestones",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET = authedRoute({ credentials: "session" }, handleGET);
export const POST = authedRoute({ credentials: "session" }, handlePOST);
