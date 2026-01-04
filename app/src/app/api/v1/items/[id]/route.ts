import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";
import type { syncItemToRoomsTask } from "../../../../../../trigger/sync-item-to-rooms";

const log = createLogger("api/v1/items/[id]");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const item = await db.item.findUnique({
      where: {
        id,
        userId: user.id, // Ensure user can only access their own items
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
        title: true,
        description: true,
        tags: true,
        userTags: true,
        notes: true,
        excludeFromPublicRooms: true,
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
          },
        },
        articleDetails: {
          select: {
            author: true,
            domain: true,
            publishedAt: true,
            readingTime: true,
            content: true,
          },
        },
        roomItems: {
          select: {
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
        },
      },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    // Log activity (fire-and-forget)
    void logActivity(user.id, "item_view", { itemId: id });

    // Flatten imageDetails and roomItems for backward compatibility with frontend
    const flattenedItem = {
      ...item,
      objects: item.imageDetails?.objects ?? [],
      colors: item.imageDetails?.colors ?? [],
      ocrText: item.imageDetails?.ocrText ?? null,
      rooms: item.roomItems.map((ri) => ri.room),
      imageDetails: undefined,
      roomItems: undefined,
    };

    return NextResponse.json(flattenedItem);
  } catch (error) {
    log.error({ error }, "Item fetch error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const {
      processingStatus,
      fileKey,
      meta,
      sourceType,
      sourceUrl,
      kind,
      coverFileKey,
      excludeFromPublicRooms,
      tags,
      userTags,
      title,
      notes,
    } = body;

    // Validate notes field type (user-editable field)
    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      return NextResponse.json(
        { message: "Invalid notes field: must be a string or null" },
        { status: 400 },
      );
    }

    // Validate userTags field
    if (userTags !== undefined) {
      if (!Array.isArray(userTags)) {
        return NextResponse.json(
          { message: "Invalid userTags field: must be an array" },
          { status: 400 },
        );
      }
      if (userTags.length > 100) {
        return NextResponse.json(
          { message: "Invalid userTags field: maximum 100 tags allowed" },
          { status: 400 },
        );
      }
      const tagRegex = /^[\w\s-]+$/u;
      for (const tag of userTags) {
        if (typeof tag !== "string") {
          return NextResponse.json(
            { message: "Invalid userTags field: all tags must be strings" },
            { status: 400 },
          );
        }
        if (tag.length === 0) {
          return NextResponse.json(
            { message: "Invalid userTags field: tags cannot be empty" },
            { status: 400 },
          );
        }
        if (tag.length > 50) {
          return NextResponse.json(
            { message: "Invalid userTags field: tags must be 50 characters or less" },
            { status: 400 },
          );
        }
        if (!tagRegex.test(tag)) {
          return NextResponse.json(
            { message: "Invalid userTags field: tags can only contain letters, numbers, spaces, hyphens, and underscores" },
            { status: 400 },
          );
        }
      }
    }

    // Check if item exists and belongs to user
    const existingItem = await db.item.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingItem) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    // Track if filter-relevant fields changed for room sync
    // Compare tags arrays by value since array equality check would always fail
    const tagsChanged =
      tags !== undefined &&
      JSON.stringify(tags.slice().sort()) !==
        JSON.stringify(existingItem.tags.slice().sort());

    const userTagsChanged =
      userTags !== undefined &&
      JSON.stringify(userTags.slice().sort()) !==
        JSON.stringify(existingItem.userTags.slice().sort());

    const filterRelevantFieldsChanged =
      (kind !== undefined && kind !== existingItem.kind) ||
      (sourceType !== undefined && sourceType !== existingItem.sourceType) ||
      (excludeFromPublicRooms !== undefined &&
        excludeFromPublicRooms !== existingItem.excludeFromPublicRooms) ||
      tagsChanged ||
      userTagsChanged;

    const updatedItem = await db.item.update({
      where: { id },
      data: {
        ...(processingStatus !== undefined && { processingStatus }),
        ...(fileKey !== undefined && { fileKey }),
        ...(meta !== undefined && { meta }),
        ...(sourceType !== undefined && { sourceType }),
        ...(sourceUrl !== undefined && { sourceUrl }),
        ...(kind !== undefined && { kind }),
        ...(coverFileKey !== undefined && { coverFileKey }),
        ...(excludeFromPublicRooms !== undefined && { excludeFromPublicRooms }),
        ...(tags !== undefined && { tags }),
        ...(userTags !== undefined && { userTags }),
        ...(title !== undefined && { title }),
        ...(notes !== undefined && { notes }),
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
        title: true,
        description: true,
        tags: true,
        userTags: true,
        notes: true,
        excludeFromPublicRooms: true,
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
          },
        },
        articleDetails: {
          select: {
            author: true,
            domain: true,
            publishedAt: true,
            readingTime: true,
            content: true,
          },
        },
        roomItems: {
          select: {
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
        },
      },
    });

    // Trigger room sync if filter-relevant fields changed
    if (filterRelevantFieldsChanged) {
      await tasks.trigger<typeof syncItemToRoomsTask>("sync-item-to-rooms", {
        itemId: id,
        userId: user.id,
      });
    }

    // Log activity (fire-and-forget)
    void logActivity(user.id, "item_update", { itemId: id });

    // Flatten imageDetails and roomItems for backward compatibility with frontend
    const flattenedItem = {
      ...updatedItem,
      objects: updatedItem.imageDetails?.objects ?? [],
      colors: updatedItem.imageDetails?.colors ?? [],
      ocrText: updatedItem.imageDetails?.ocrText ?? null,
      rooms: updatedItem.roomItems.map((ri) => ri.room),
      imageDetails: undefined,
      roomItems: undefined,
    };

    return NextResponse.json(flattenedItem);
  } catch (error) {
    log.error({ error }, "Item update error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    // Check if item exists and belongs to user
    const existingItem = await db.item.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingItem) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    await db.item.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({ error }, "Item deletion error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
