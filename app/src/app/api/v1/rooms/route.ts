import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import {
  canCreateSmartRoom,
  generateRoomSlug,
  hasValidFilters,
  MAX_SMART_ROOMS_PER_USER,
} from "@/lib/rooms";
import type { Filter } from "@/lib/search/types";
import { createClient } from "@/lib/supabase/server";
import type { syncRoomItemsTask } from "../../../../../trigger/sync-room-items";

const log = createLogger("api/v1/rooms");

/**
 * GET /api/v1/rooms - List all rooms for the current user
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rooms = await db.room.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        type: true,
        filters: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { roomItems: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to include itemCount at top level
    const roomsWithCount = rooms.map((room) => ({
      ...room,
      itemCount: room._count.roomItems,
      _count: undefined,
    }));

    return NextResponse.json(roomsWithCount);
  } catch (error) {
    log.error({ error }, "Rooms fetch error");
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
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, filters, visibility } = body;

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
      const canCreate = await canCreateSmartRoom(user.id);
      if (!canCreate) {
        return NextResponse.json(
          {
            message: `You can only have ${MAX_SMART_ROOMS_PER_USER} smart rooms`,
          },
          { status: 400 },
        );
      }

      // Smart rooms must have at least one filter
      const filterArray = filters as Filter[] | undefined;
      if (!hasValidFilters(filterArray ?? null)) {
        return NextResponse.json(
          { message: "Smart rooms require at least one filter" },
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
        slug,
        type,
        filters: type === "smart" ? filters : null,
        visibility: visibility || "private",
      },
      select: {
        id: true,
        name: true,
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

    return NextResponse.json(
      { ...room, itemCount: 0, username: dbUser?.username ?? null },
      { status: 201 },
    );
  } catch (error) {
    log.error({ error }, "Room creation error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
