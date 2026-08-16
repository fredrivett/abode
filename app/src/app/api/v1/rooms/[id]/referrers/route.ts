import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/rooms/[id]/referrers");

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/rooms/:id/referrers - Get embed referrer stats for a room
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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

    // Verify room ownership
    const room = await db.room.findUnique({
      where: {
        id,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!room) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    // Fetch referrers, ordered by most recent
    const referrers = await db.roomEmbedReferrer.findMany({
      where: { roomId: id },
      select: {
        referrerUrl: true,
        referrerDomain: true,
        firstSeenAt: true,
        lastSeenAt: true,
        viewCount: true,
      },
      orderBy: { lastSeenAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      referrers: referrers.map((r) => ({
        url: r.referrerUrl,
        domain: r.referrerDomain,
        firstSeenAt: r.firstSeenAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
        viewCount: r.viewCount,
      })),
    });
  } catch (error) {
    log.error({ error }, "Referrers fetch error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/rooms/[id]/referrers",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
