import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/items/status");

/**
 * GET /api/v1/items/status?ids=id1,id2,id3
 * Returns the processing status and last update time for the given item IDs.
 * Lightweight endpoint for polling processing items — `updatedAt` lets the
 * client detect mid-processing progress (e.g. a URL being classified).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const idsParam = request.nextUrl.searchParams.get("ids");
    if (!idsParam) {
      return NextResponse.json(
        { message: "ids parameter is required" },
        { status: 400 },
      );
    }

    const ids = idsParam.split(",").filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Limit to prevent abuse
    if (ids.length > 50) {
      return NextResponse.json(
        { message: "Maximum 50 items per request" },
        { status: 400 },
      );
    }

    const items = await db.item.findMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
      select: {
        id: true,
        processingStatus: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ items });
  } catch (error) {
    log.error({ error }, "Items status fetch error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/items/status",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
