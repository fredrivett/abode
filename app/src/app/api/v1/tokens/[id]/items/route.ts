import { type NextRequest, NextResponse } from "next/server";
import type { Principal } from "@/lib/auth/authenticate-request";
import { authedRoute } from "@/lib/http/authed-route";
import { createLogger } from "@/lib/logger.server";
import { decodeCursor, parsePageSize } from "@/lib/pagination";
import { listTokenSavedItems } from "@/lib/personal-access-tokens";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("api/v1/tokens/[id]/items");

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/v1/tokens/:id/items - The items a personal access token saved,
 * newest first (`?cursor=` for the next page). Session-only: a token can't
 * list what tokens did.
 */
async function handleGET(
  request: NextRequest,
  { params, principal }: RouteParams & { principal: Principal },
) {
  try {
    const { id } = await params;
    const { user } = principal;

    // Absent = first page; present but empty or undecodable = a bad request
    const rawCursor = request.nextUrl.searchParams.get("cursor");
    const cursor = rawCursor === null ? null : decodeCursor(rawCursor);
    if (rawCursor !== null && !cursor) {
      return NextResponse.json({ message: "Invalid cursor" }, { status: 400 });
    }

    const page = await listTokenSavedItems({
      userId: user.id,
      tokenId: id,
      cursor,
      limit: parsePageSize(request.nextUrl.searchParams.get("limit")),
    });
    if (!page) {
      return NextResponse.json({ message: "Token not found" }, { status: 404 });
    }

    return NextResponse.json(page);
  } catch (error) {
    log.error({ error }, "Failed to list token items");
    captureServerException(error, undefined, {
      route: "GET /api/v1/tokens/[id]/items",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET = authedRoute({ credentials: "session" }, handleGET);
