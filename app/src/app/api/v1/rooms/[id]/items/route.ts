import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/rooms/[id]/items");

const PAGE_SIZE = 100;

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/rooms/:id/items - Get paginated items in a room
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(
      Number.parseInt(searchParams.get("limit") || String(PAGE_SIZE), 10),
      PAGE_SIZE,
    );

    // Get room items with their associated items
    const roomItems = await db.roomItem.findMany({
      where: { roomId: id },
      take: limit + 1, // Get one extra to determine if there are more
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { addedAt: "desc" },
      select: {
        id: true,
        addedAt: true,
        item: {
          select: {
            id: true,
            userId: true,
            kind: true,
            processingStatus: true,
            fileKey: true,
            meta: true,
            sourceType: true,
            sourceUrl: true,
            coverFileKey: true,
            createdAt: true,
            updatedAt: true,
            title: true,
            description: true,
            tags: true,
            locations: {
              select: {
                id: true,
                source: true,
                latitude: true,
                longitude: true,
                neighborhood: true,
                city: true,
                region: true,
                country: true,
                countryCode: true,
                formatted: true,
              },
            },
            imageDetails: {
              select: {
                objects: true,
                colors: true,
                ocrText: true,
                captureDate: true,
              },
            },
            articleDetails: {
              select: {
                author: true,
                domain: true,
                publishedAt: true,
                readingTime: true,
              },
            },
          },
        },
      },
    });

    // Check if there are more results
    const hasMore = roomItems.length > limit;
    const items = hasMore ? roomItems.slice(0, limit) : roomItems;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    // Flatten item details for frontend compatibility
    const flattenedItems = items.map((roomItem) => ({
      roomItemId: roomItem.id,
      addedAt: roomItem.addedAt,
      ...roomItem.item,
      objects: roomItem.item.imageDetails?.objects ?? [],
      colors: roomItem.item.imageDetails?.colors ?? [],
      ocrText: roomItem.item.imageDetails?.ocrText ?? null,
      captureDate: roomItem.item.imageDetails?.captureDate ?? null,
      imageDetails: undefined,
    }));

    return NextResponse.json({
      items: flattenedItems,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    log.error({ error }, "Room items fetch error");
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
    } = await supabase.auth.getUser();

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
        room: roomItem.room,
      },
      { status: 201 },
    );
  } catch (error) {
    log.error({ error }, "Add item to room error");
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
    } = await supabase.auth.getUser();

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
      return NextResponse.json({ message: "Item not in room" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ error }, "Remove item from room error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
