import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { markMilestoneComplete } from "@/lib/milestones";
import { shouldCompleteCreateDynamicRoom } from "@/lib/milestones/conditions";
import { captureServerException } from "@/lib/posthog-server";
import { generateRoomSlug, hasValidFilters, listUserRooms } from "@/lib/rooms";
import type { Filter } from "@/lib/search/types";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";
import type { syncRoomItemsTask } from "../../../../../trigger/sync-room-items";

const log = createLogger("api/v1/rooms");

/**
 * GET /api/v1/rooms - List all rooms for the current user
 * Query params:
 *   - type: Filter by room type ('smart' | 'manual')
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const typeParam = new URL(request.url).searchParams.get("type");

    // Validate type filter if provided
    if (typeParam && typeParam !== "smart" && typeParam !== "manual") {
      return NextResponse.json(
        { message: "Type must be 'smart' or 'manual'" },
        { status: 400 },
      );
    }

    const typeFilter =
      typeParam === "smart" || typeParam === "manual" ? typeParam : undefined;
    const rooms = await listUserRooms(user.id, typeFilter);
    return NextResponse.json(rooms);
  } catch (error) {
    log.error({ error }, "Rooms fetch error");
    captureServerException(error, undefined, { route: "GET /api/v1/rooms" });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/rooms - Create a new room
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, emoji, type, filters, visibility } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { message: "Room name is required" },
        { status: 400 },
      );
    }

    if (!type || !["smart", "manual"].includes(type)) {
      return NextResponse.json(
        { message: "Room type must be 'smart' or 'manual'" },
        { status: 400 },
      );
    }

    // For smart rooms, enforce limit and validate filters
    if (type === "smart") {
      // TODO: Re-enable smart room limit after early access period
      // const canCreate = await canCreateSmartRoom(user.id);
      // if (!canCreate) {
      //   return NextResponse.json(
      //     {
      //       message: `You can only have ${MAX_SMART_ROOMS_PER_USER} dynamic rooms`,
      //     },
      //     { status: 400 },
      //   );
      // }

      // Smart rooms must have at least one filter
      const filterArray = filters as Filter[] | undefined;
      if (!hasValidFilters(filterArray ?? null)) {
        return NextResponse.json(
          { message: "Dynamic rooms require at least one filter" },
          { status: 400 },
        );
      }
    }

    // Validate visibility if provided
    if (visibility && !["private", "public"].includes(visibility)) {
      return NextResponse.json(
        { message: "Visibility must be 'private' or 'public'" },
        { status: 400 },
      );
    }

    // Generate slug from room name
    const slug = await generateRoomSlug(name.trim(), user.id);

    // Get username for URL construction
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { username: true },
    });

    // Create the room
    const room = await db.room.create({
      data: {
        userId: user.id,
        name: name.trim(),
        emoji: emoji || null,
        slug,
        type,
        filters: type === "smart" ? filters : null,
        visibility: visibility || "private",
      },
      select: {
        id: true,
        name: true,
        emoji: true,
        slug: true,
        type: true,
        filters: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // For smart rooms, trigger initial population
    if (type === "smart") {
      await tasks.trigger<typeof syncRoomItemsTask>("sync-room-items", {
        roomId: room.id,
        userId: user.id,
      });
    }

    // Log activity (fire-and-forget)
    void logActivity(user.id, "room_create", { roomId: room.id, type });

    // Mark milestones for room creation
    void markMilestoneComplete(user.id, "create_first_room");
    if (shouldCompleteCreateDynamicRoom(type)) {
      void markMilestoneComplete(user.id, "create_dynamic_room");
    }

    return NextResponse.json(
      { ...room, itemCount: 0, username: dbUser?.username ?? null },
      { status: 201 },
    );
  } catch (error) {
    log.error({ error }, "Room creation error");
    captureServerException(error, undefined, { route: "POST /api/v1/rooms" });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
