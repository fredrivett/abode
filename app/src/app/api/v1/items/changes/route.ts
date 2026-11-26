import { type NextRequest, NextResponse } from "next/server";
import type { Principal } from "@/lib/auth/authenticate-request";
import { authedRoute } from "@/lib/http/authed-route";
import { decodeChangesCursor, listItemChanges } from "@/lib/items/changes";
import { createLogger } from "@/lib/logger.server";
import { parsePageSize } from "@/lib/pagination";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("api/v1/items/changes");

// The offline library keeps its own copy; the service worker's API cache
// would only hold the library a second time and push out entries it needs
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/v1/items/changes?cursor=&limit=
 *
 * The caller's items changed since `cursor`, oldest change first, as the
 * offline library stores them. No cursor starts from the beginning (a first
 * sync). Keep requesting with the returned `cursor` while `hasMore`; once it's
 * false, save the cursor for the next round.
 */
async function handleGET(
  request: NextRequest,
  { principal }: { principal: Principal },
) {
  try {
    const { searchParams } = request.nextUrl;
    const rawCursor = searchParams.get("cursor");
    const after = rawCursor ? decodeChangesCursor(rawCursor) : null;
    if (rawCursor && !after) {
      return NextResponse.json(
        { message: "Invalid cursor" },
        { status: 400, headers: NO_STORE },
      );
    }

    const page = await listItemChanges({
      userId: principal.user.id,
      after,
      limit: parsePageSize(searchParams.get("limit")),
    });
    return NextResponse.json(page, { headers: NO_STORE });
  } catch (error) {
    log.error({ error }, "Item changes fetch error");
    captureServerException(error, principal.user.id, {
      route: "GET /api/v1/items/changes",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: NO_STORE },
    );
  }
}

export const GET = authedRoute({ credentials: "session" }, handleGET);
