import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { hasValidFilters } from "@/lib/rooms";
import type { Filter } from "@/lib/search/types";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";
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
    } = await getUserWithMfa(supabase);

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
        emoji: true,
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

    // Log activity (fire-and-forget)
    void logActivity(user.id, "room_view", { roomId: id });

    return NextResponse.json({
      ...room,
      itemCount: room._count.roomItems,
      _count: undefined,
    });
  } catch (error) {
    log.error({ error }, "Room fetch error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/rooms/[id]",
    });
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
    } = await getUserWithMfa(supabase);

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
    const { name, emoji, filters, visibility } = body;

    // Build update data
    const updateData: {
      name?: string;
      emoji?: string | null;
      filters?: Filter[];
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

    if (emoji !== undefined) {
      updateData.emoji = emoji || null;
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

    // Handle filter updates for smart rooms
    const shouldSyncRoom =
      filters !== undefined && existingRoom.type === "smart";

    if (shouldSyncRoom) {
      const filterArray = filters as Filter[];
      if (!hasValidFilters(filterArray)) {
        return NextResponse.json(
          { message: "Dynamic rooms require at least one filter" },
          { status: 400 },
        );
      }
      updateData.filters = filterArray;
    }

    // Update the room
    const updatedRoom = await db.room.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        emoji: true,
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
    if (shouldSyncRoom) {
      await tasks.trigger<typeof syncRoomItemsTask>("sync-room-items", {
        roomId: id,
        userId: user.id,
      });
    }

    // Log activity (fire-and-forget)
    void logActivity(user.id, "room_update", { roomId: id });

    // Track room update with PostHog
    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "room_updated",
      properties: {
        room_id: id,
        room_type: existingRoom.type,
        updated_name: name !== undefined,
        updated_emoji: emoji !== undefined,
        updated_visibility: visibility !== undefined,
        updated_filters: shouldSyncRoom,
        new_visibility: visibility,
        old_visibility:
          visibility !== undefined ? existingRoom.visibility : undefined,
      },
    });

    return NextResponse.json({
      ...updatedRoom,
      itemCount: updatedRoom._count.roomItems,
      _count: undefined,
    });
  } catch (error) {
    log.error({ error }, "Room update error");
    captureServerException(error, undefined, {
      route: "PATCH /api/v1/rooms/[id]",
    });
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
    } = await getUserWithMfa(supabase);

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

    // Log activity (fire-and-forget)
    void logActivity(user.id, "room_delete", { roomId: id });

    // Track room deletion with PostHog
    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "room_deleted",
      properties: {
        room_id: id,
        room_type: existingRoom.type,
        room_visibility: existingRoom.visibility,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ error }, "Room deletion error");
    captureServerException(error, undefined, {
      route: "DELETE /api/v1/rooms/[id]",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
