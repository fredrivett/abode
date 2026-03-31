import type { Prisma } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import db from "@/lib/db";
import { itemSelect, transformItem } from "@/lib/items/query";
import { createLogger } from "@/lib/logger.server";
import { markMilestoneComplete } from "@/lib/milestones";
import {
  DEFAULT_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  MAX_PAGE_SIZE,
} from "@/lib/pagination";
import { captureServerException } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";
import { getFileSizeFromMeta } from "@/lib/utils";
import type { analyzeImageTask } from "../../../../../trigger/analyze-image";

const log = createLogger("api/v1/items");

const allowedKinds = new Set(["image", "article", "webpage"]);

/**
 * GET /api/v1/items
 *
 * Supports cursor-based pagination with optional `cursor` and `limit` query params.
 * Returns { items, cursor, hasMore, total } for paginated requests.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(
      Math.max(1, Number.parseInt(limitParam || String(DEFAULT_PAGE_SIZE), 10)),
      MAX_PAGE_SIZE,
    );

    // Decode cursor if provided
    const cursorData = cursor ? decodeCursor(cursor) : null;

    // Build where clause - add cursor conditions if present
    const baseWhere = { userId: user.id };
    let whereClause: Prisma.ItemWhereInput;

    if (cursorData) {
      const cursorDate = new Date(cursorData.createdAt);
      whereClause = {
        ...baseWhere,
        OR: [
          { createdAt: { lt: cursorDate } },
          {
            createdAt: { equals: cursorDate },
            id: { lt: cursorData.id },
          },
        ],
      };
    } else {
      whereClause = baseWhere;
    }

    // Fetch one extra to check if there are more results
    const fetchLimit = limit + 1;

    // Only fetch total count on first page (no cursor)
    const [items, total] = await Promise.all([
      db.item.findMany({
        where: whereClause,
        select: itemSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: fetchLimit,
      }),
      cursorData
        ? Promise.resolve(undefined)
        : db.item.count({ where: baseWhere }),
    ]);

    // Check if there are more results
    const hasMore = items.length > limit;
    const pageItems = items.slice(0, limit);

    // Generate cursor for next page
    let nextCursor: string | undefined;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      nextCursor = encodeCursor({
        createdAt: lastItem.createdAt.toISOString(),
        id: lastItem.id,
      });
    }

    // Transform items for client
    const transformedItems = pageItems.map(transformItem);

    return NextResponse.json({
      items: transformedItems,
      cursor: nextCursor ?? null,
      hasMore,
      ...(total !== undefined && { total }),
    });
  } catch (error) {
    log.error({ error }, "Items fetch error");
    captureServerException(error, undefined, { route: "GET /api/v1/items" });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

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
    const { kind, fileKey, meta, sourceType, sourceUrl } = body;

    // kind is optional (null for URL-sourced items during classification)
    // but if provided, must be valid
    if (kind && !allowedKinds.has(kind)) {
      return NextResponse.json(
        { message: "Kind must be valid if provided" },
        { status: 400 },
      );
    }

    if (fileKey && !fileKey.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { message: "File key must be in the user's folder" },
        { status: 400 },
      );
    }

    // Get file size from meta for storage tracking
    const fileSize = getFileSizeFromMeta(meta);

    // Create the item and update user storage in a transaction
    const item = await db.$transaction(async (tx) => {
      const newItem = await tx.item.create({
        data: {
          kind: kind || null,
          fileKey: fileKey || null,
          meta: meta || null,
          sourceType: sourceType || null,
          sourceUrl: sourceUrl || null,
          userId: user.id,
          processingStatus: "processing",
        },
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
        },
      });

      // Update user's storage usage and item count
      await tx.user.update({
        where: { id: user.id },
        data: {
          itemCount: { increment: 1 },
          ...(fileSize > 0 && { storageUsedBytes: { increment: fileSize } }),
        },
      });

      return newItem;
    });

    // Trigger image analysis via Trigger.dev (returns immediately)
    if (kind === "image" && fileKey) {
      await tasks.trigger<typeof analyzeImageTask>("analyze-image", {
        itemId: item.id,
        userId: user.id,
        fileKey,
      });
    }

    // Log activity (fire-and-forget)
    void logActivity(user.id, "item_create", { itemId: item.id, kind });

    // Mark milestone for first image upload
    if (kind === "image") {
      void markMilestoneComplete(user.id, "upload_first_image");
    }

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    log.error({ error }, "Item creation error");
    captureServerException(error, undefined, { route: "POST /api/v1/items" });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { message: "Item ID is required" },
        { status: 400 },
      );
    }

    // Find the item to ensure it exists and belongs to the user
    const item = await db.item.findUnique({
      where: { id },
      select: { id: true, userId: true, fileKey: true, meta: true },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    if (item.userId !== user.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Delete from storage if there's a file
    if (item.fileKey) {
      const { error: storageError } = await supabase.storage
        .from("items")
        .remove([item.fileKey]);

      if (storageError) {
        log.error(
          { itemId: id, error: storageError },
          "Storage deletion error",
        );
        // Continue with DB deletion even if storage deletion fails
      }
    }

    // Get file size for storage tracking
    const fileSize = getFileSizeFromMeta(item.meta);

    // Delete from database and update storage in a transaction
    await db.$transaction(async (tx) => {
      await tx.item.delete({
        where: { id },
      });

      // Decrement user's storage usage and item count
      await tx.user.update({
        where: { id: user.id },
        data: {
          itemCount: { decrement: 1 },
          ...(fileSize > 0 && { storageUsedBytes: { decrement: fileSize } }),
        },
      });
    });

    // Log activity (fire-and-forget)
    void logActivity(user.id, "item_delete", { itemId: id });

    return NextResponse.json({ message: "Item deleted" }, { status: 200 });
  } catch (error) {
    log.error({ error }, "Item deletion error");
    captureServerException(error, undefined, {
      route: "DELETE /api/v1/items",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
