import { type NextRequest, NextResponse } from "next/server";
import type { Principal } from "@/lib/auth/authenticate-request";
import db from "@/lib/db";
import { authedRoute } from "@/lib/http/authed-route";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";

const log = createLogger("api/v1/user/stats");

async function handleGET(
  _request: NextRequest,
  { principal }: { principal: Principal },
) {
  try {
    const { user } = principal;

    const [itemCount, roomCount] = await Promise.all([
      db.item.count({
        where: { userId: user.id },
      }),
      db.room.count({
        where: { userId: user.id },
      }),
    ]);

    return NextResponse.json({ itemCount, roomCount });
  } catch (error) {
    log.error({ error }, "Stats fetch error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/user/stats",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET = authedRoute({ credentials: "session" }, handleGET);
