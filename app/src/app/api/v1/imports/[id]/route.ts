import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Principal } from "@/lib/auth/authenticate-request";
import db from "@/lib/db";
import { authedRoute } from "@/lib/http/authed-route";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("api/imports/[id]");

/** Poll a single import's status + counts (owner-scoped). Drives the progress UI. */
async function handleGET(
  _request: NextRequest,
  {
    params,
    principal,
  }: { params: Promise<{ id: string }>; principal: Principal },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const itemImport = await db.itemImport.findFirst({
      where: { id, userId: principal.user.id },
      select: {
        id: true,
        source: true,
        status: true,
        totalCount: true,
        importedCount: true,
        skippedCount: true,
        failedCount: true,
        error: true,
        createdAt: true,
        completedAt: true,
      },
    });

    if (!itemImport) {
      return NextResponse.json(
        { message: "Import not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(itemImport);
  } catch (error) {
    log.error({ error }, "Failed to fetch import status");
    captureServerException(error, undefined, {
      route: "GET /api/v1/imports/[id]",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET = authedRoute({ tokenScope: null }, handleGET);
