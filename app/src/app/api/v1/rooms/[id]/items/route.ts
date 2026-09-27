import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { canViewRoom, viewableRoomItemsWhere } from "@/lib/rooms/room-access";
import { roomItemSelect, toClientRoomItem } from "@/lib/rooms/room-item-query";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";

const log = createLogger("api/v1/rooms/[id]/items");

const PAGE_SIZE = 100;

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/rooms/:id/items - Get paginated items in a room.
 *
 * Mirrors the room page's access: the owner sees every item; anyone else
 * (signed in or not) can page through a public room's publicly viewable
 * items. A private room is a 404 to non-owners, so its existence isn't
 * revealed.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await getUserWithMfa(supabase);
    const viewerId = user?.id ?? null;

    const room = await db.room.findUnique({
      where: { id },
      select: { id: true, userId: true, visibility: true },
    });

    if (!room || !canViewRoom({ room, viewerId })) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }
    const isOwner = room.userId === viewerId;

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(
      Number.parseInt(searchParams.get("limit") || String(PAGE_SIZE), 10),
      PAGE_SIZE,
    );

    // Get room items with their associated items
    const roomItems = await db.roomItem.findMany({
      where: viewableRoomItemsWhere({ roomId: room.id, isOwner }),
      take: limit + 1, // Get one extra to determine if there are more
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { addedAt: "desc" },
      // Same shape as the room page's first page, so loaded-more cards render
      // (and size) with all their details
      select: roomItemSelect,
    });

    // Check if there are more results
    const hasMore = roomItems.length > limit;
    const items = hasMore ? roomItems.slice(0, limit) : roomItems;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return NextResponse.json({
      items: items.map(toClientRoomItem),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    log.error({ error }, "Room items fetch error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/rooms/[id]/items",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/rooms/:id/items - Add an item to a manual room
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const { itemId } = body;

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json(
        { message: "Item ID is required" },
        { status: 400 },
      );
    }

    // Check if room exists, belongs to user, and is a manual room
    const room = await db.room.findUnique({
      where: {
        id,
        userId: user.id,
      },
      select: { id: true, type: true },
    });

    if (!room) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    if (room.type !== "manual") {
      return NextResponse.json(
        { message: "Can only add items to manual rooms" },
        { status: 400 },
      );
    }

    // Check if item exists and belongs to user
    const item = await db.item.findUnique({
      where: {
        id: itemId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    // Check if already in room
    const existing = await db.roomItem.findUnique({
      where: {
        roomId_itemId: { roomId: id, itemId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: "Item already in room" },
        { status: 409 },
      );
    }

    // Create the room item
    const roomItem = await db.roomItem.create({
      data: {
        roomId: id,
        itemId,
      },
      select: {
        id: true,
        addedAt: true,
        room: {
          select: {
            id: true,
            name: true,
            emoji: true,
            slug: true,
            type: true,
            user: {
              select: {
                username: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        roomItem: {
          id: roomItem.id,
          addedAt: roomItem.addedAt,
        },
        room: {
          id: roomItem.room.id,
          name: roomItem.room.name,
          emoji: roomItem.room.emoji,
          slug: roomItem.room.slug,
          type: roomItem.room.type,
          username: roomItem.room.user.username,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    log.error({ error }, "Add item to room error");
    captureServerException(error, undefined, {
      route: "POST /api/v1/rooms/[id]/items",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/rooms/:id/items - Remove an item from a manual room
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const { itemId } = body;

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json(
        { message: "Item ID is required" },
        { status: 400 },
      );
    }

    // Check if room exists, belongs to user, and is a manual room
    const room = await db.room.findUnique({
      where: {
        id,
        userId: user.id,
      },
      select: { id: true, type: true },
    });

    if (!room) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    if (room.type !== "manual") {
      return NextResponse.json(
        { message: "Can only remove items from manual rooms" },
        { status: 400 },
      );
    }

    // Delete the room item (returns count of deleted records)
    const { count } = await db.roomItem.deleteMany({
      where: {
        roomId: id,
        itemId,
      },
    });

    if (count === 0) {
      return NextResponse.json(
        { message: "Item not in room" },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ error }, "Remove item from room error");
    captureServerException(error, undefined, {
      route: "DELETE /api/v1/rooms/[id]/items",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
