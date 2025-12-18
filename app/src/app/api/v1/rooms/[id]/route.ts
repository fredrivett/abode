import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { hasValidFilters, type RoomFilters } from "@/lib/rooms";
import { createClient } from "@/lib/supabase/server";
import type { syncRoomItemsTask } from "../../../../../../trigger/sync-room-items";

const log = createLogger("api/v1/rooms/[id]");

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/rooms/:id - Get a single room by ID
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const room = await db.room.findUnique({
      where: {
        id,
        userId: user.id,
      },
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
    });

    if (!room) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...room,
      itemCount: room._count.roomItems,
      _count: undefined,
    });
  } catch (error) {
    log.error({ error }, "Room fetch error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/rooms/:id - Update a room
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if room exists and belongs to user
    const existingRoom = await db.room.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingRoom) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, filters, visibility } = body;

    // Build update data
    const updateData: {
      name?: string;
      filters?: RoomFilters;
      visibility?: "private" | "public";
    } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { message: "Room name cannot be empty" },
          { status: 400 },
        );
      }
      updateData.name = name.trim();
    }

    if (visibility !== undefined) {
      if (!["private", "public"].includes(visibility)) {
        return NextResponse.json(
          { message: "Visibility must be 'private' or 'public'" },
          { status: 400 },
        );
      }
      updateData.visibility = visibility;
    }

    // Track if filters changed for smart rooms
    let filtersChanged = false;

    if (filters !== undefined && existingRoom.type === "smart") {
      const roomFilters = filters as RoomFilters;
      if (!hasValidFilters(roomFilters)) {
        return NextResponse.json(
          { message: "Smart rooms require at least one filter" },
          { status: 400 },
        );
      }
      updateData.filters = roomFilters;
      filtersChanged = true;
    }

    // Update the room
    const updatedRoom = await db.room.update({
      where: { id },
      data: updateData,
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
    });

    // If filters changed, trigger re-sync
    if (filtersChanged) {
      await tasks.trigger<typeof syncRoomItemsTask>("sync-room-items", {
        roomId: id,
        userId: user.id,
      });
    }

    return NextResponse.json({
      ...updatedRoom,
      itemCount: updatedRoom._count.roomItems,
      _count: undefined,
    });
  } catch (error) {
    log.error({ error }, "Room update error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/rooms/:id - Delete a room
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if room exists and belongs to user
    const existingRoom = await db.room.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingRoom) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    // Hard delete (cascades to room_items)
    await db.room.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ error }, "Room deletion error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
