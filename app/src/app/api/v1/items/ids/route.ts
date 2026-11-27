import { NextResponse } from "next/server";
import type { Principal } from "@/lib/auth/authenticate-request";
import { authedRoute } from "@/lib/http/authed-route";
import { listItemIds } from "@/lib/items/changes";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("api/v1/items/ids");

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET /api/v1/items/ids
 *
 * Every one of the caller's item ids. The offline library asks only when its
 * item count differs from the server's, to drop items deleted elsewhere.
 */
async function handleGET(
  _request: Request,
  { principal }: { principal: Principal },
) {
  try {
    const ids = await listItemIds(principal.user.id);
    return NextResponse.json({ ids }, { headers: NO_STORE });
  } catch (error) {
    log.error({ error }, "Item ids fetch error");
    captureServerException(error, principal.user.id, {
      route: "GET /api/v1/items/ids",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: NO_STORE },
    );
  }
}

export const GET = authedRoute({ credentials: "session" }, handleGET);
