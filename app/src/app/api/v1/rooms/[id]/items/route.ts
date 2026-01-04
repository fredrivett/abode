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
            userTags: true,
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
