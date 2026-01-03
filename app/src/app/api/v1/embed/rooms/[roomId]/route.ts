import { type NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getDisplayName } from "@/lib/get-display-name";
import { createLogger } from "@/lib/logger.server";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { getAppBaseUrl } from "@/lib/url";

const log = createLogger("api/v1/embed/rooms/[roomId]");

// Cache embed data for 5 minutes in browser, 10 minutes on CDN
const CACHE_CONTROL = "public, max-age=300, s-maxage=600";

// Cache 404s briefly
const CACHE_CONTROL_NOT_FOUND = "public, max-age=60, s-maxage=300";

// CORS headers for cross-origin widget requests
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

type RouteParams = { params: Promise<{ roomId: string }> };

/**
 * OPTIONS /api/v1/embed/rooms/:roomId - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * GET /api/v1/embed/rooms/:roomId - Get public room data for embedding
 *
 * Returns room metadata, owner info, and up to 12 item thumbnails for public rooms only.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { roomId } = await params;

    // Rate limit by IP
    const clientIp = getClientIp(request.headers);
    const rateLimitResult = checkRateLimit(clientIp, "embed");

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { message: "Too many requests" },
        {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            ...getRateLimitHeaders(rateLimitResult, "embed"),
          },
        },
      );
    }

    // Validate roomId is a valid UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(roomId)) {
      return NextResponse.json(
        { message: "Invalid room ID" },
        {
          status: 400,
          headers: CORS_HEADERS,
        },
      );
    }

    // Fixed limit of 12 items for embed previews
    const limit = 12;

    // Fetch room with owner info - only if public
    const room = await db.room.findFirst({
      where: {
        id: roomId,
        visibility: "public",
      },
      select: {
        id: true,
        name: true,
        emoji: true,
        slug: true,
        filters: true,
        _count: {
          select: { roomItems: true },
        },
        user: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { message: "Room not found" },
        {
          status: 404,
          headers: {
            ...CORS_HEADERS,
            "Cache-Control": CACHE_CONTROL_NOT_FOUND,
          },
        },
      );
    }

    // Fetch room items for preview
    const roomItems = await db.roomItem.findMany({
      where: { roomId },
      take: limit,
      orderBy: { addedAt: "desc" },
      select: {
        item: {
          select: {
            id: true,
            kind: true,
            title: true,
            fileKey: true,
            coverFileKey: true,
            meta: true,
            excludeFromPublicRooms: true,
          },
        },
      },
    });

    // Filter out items excluded from public rooms and build response
    const items = roomItems
      .filter((ri) => !ri.item.excludeFromPublicRooms)
      .map((ri) => {
        const meta = ri.item.meta as Record<string, unknown> | null;
        const isArticle = ri.item.kind === "article";

        // Build image URL using the proxy endpoint
        const imageFileKey = isArticle ? ri.item.coverFileKey : ri.item.fileKey;

        return {
          id: ri.item.id,
          kind: ri.item.kind,
          title: ri.item.title,
          imageUrl: imageFileKey
            ? `/api/v1/images/${encodeURIComponent(imageFileKey)}`
            : null,
          width: isArticle ? 16 : ((meta?.width as number) ?? 1),
          height: isArticle ? 9 : ((meta?.height as number) ?? 1),
        };
      });

    // Construct the room URL
    const baseUrl = getAppBaseUrl();
    const roomUrl = `${baseUrl}/@${room.user.username}/${room.slug}`;

    const response = {
      room: {
        id: room.id,
        name: room.name,
        emoji: room.emoji,
        slug: room.slug,
        itemCount: room._count.roomItems,
        filters: room.filters ?? [],
      },
      owner: {
        username: room.user.username,
        displayName: getDisplayName(room.user),
      },
      items,
      roomUrl,
    };

    return NextResponse.json(response, {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": CACHE_CONTROL,
        ...getRateLimitHeaders(rateLimitResult, "embed"),
      },
    });
  } catch (error) {
    log.error({ error }, "Embed API error");
    return NextResponse.json(
      { message: "Internal server error" },
      {
        status: 500,
        headers: CORS_HEADERS,
      },
    );
  }
}
