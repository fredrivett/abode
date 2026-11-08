import { NotFoundError, runs } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { withViewer } from "@/lib/http/with-viewer";
import { roomTag } from "@/lib/items/run-tags";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/rooms/[id]/sync/[runId]");

type RouteParams = { params: Promise<{ id: string; runId: string }> };

/**
 * GET /api/v1/rooms/:id/sync/:runId - Status of a room's membership sync
 *
 * Polled by the room page after its owner saves new filters (the PATCH returns
 * the run id), so the grid refreshes once the background sync has finished.
 * Owner-only, and the run must be a sync of this room, so a run id can't be
 * used to read another room's or task's run.
 */
async function handleGET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, runId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const room = await db.room.findUnique({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!room) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    const run = await runs.retrieve(runId).catch((error: unknown) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    });
    if (
      !run ||
      run.taskIdentifier !== "sync-room-items" ||
      !run.tags.includes(roomTag(id))
    ) {
      return NextResponse.json({ message: "Sync not found" }, { status: 404 });
    }

    if (!run.isCompleted) {
      return NextResponse.json({ status: "pending" });
    }
    if (!run.isSuccess) {
      return NextResponse.json({ status: "failed" });
    }

    const itemCount = await db.roomItem.count({ where: { roomId: id } });
    return NextResponse.json({ status: "completed", itemCount });
  } catch (error) {
    log.error({ error }, "Room sync status error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/rooms/[id]/sync/[runId]",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET = withViewer(handleGET);
