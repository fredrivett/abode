import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { markMilestoneComplete } from "@/lib/milestones";
import {
  shouldCompleteAddFirstTag,
  shouldCompleteSeeAiAnalysis,
} from "@/lib/milestones/conditions";
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
        processingError: true,
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
        sharedAt: true,
        sharedHighlights: true,
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
        noteDetails: {
          select: {
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

    // Mark milestone for seeing AI analysis
    const shouldMarkSeeAiAnalysis = shouldCompleteSeeAiAnalysis(
      item.processingStatus,
    );
    log.info(
      {
        userId: user.id,
        itemId: id,
        processingStatus: item.processingStatus,
        shouldMarkSeeAiAnalysis,
      },
      "Checking see_ai_analysis milestone condition",
    );
    if (shouldMarkSeeAiAnalysis) {
      void markMilestoneComplete(user.id, "see_ai_analysis");
    }

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
      coverFileKey,
      excludeFromPublicRooms,
      tags,
      userTags,
      title,
      notes,
      shared,
      sharedHighlights,
      content,
      twitterCoverMediaIndex,
      productCoverImageIndex,
    } = body;

    // Validate notes field type (user-editable field)
    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      return NextResponse.json(
        { message: "Invalid notes field: must be a string or null" },
        { status: 400 },
      );
    }

    // Validate sharing fields
    if (shared !== undefined && typeof shared !== "boolean") {
      return NextResponse.json(
        { message: "Invalid shared field: must be a boolean" },
        { status: 400 },
      );
    }
    if (
      sharedHighlights !== undefined &&
      typeof sharedHighlights !== "boolean"
    ) {
      return NextResponse.json(
        { message: "Invalid sharedHighlights field: must be a boolean" },
        { status: 400 },
      );
    }

    // Validate note body content (user-editable markdown for note items)
    if (content !== undefined && typeof content !== "string") {
      return NextResponse.json(
        { message: "Invalid content field: must be a string" },
        { status: 400 },
      );
    }

    // Validate twitterCoverMediaIndex field
    if (
      twitterCoverMediaIndex !== undefined &&
      twitterCoverMediaIndex !== null &&
      (typeof twitterCoverMediaIndex !== "number" ||
        !Number.isInteger(twitterCoverMediaIndex) ||
        twitterCoverMediaIndex < 0)
    ) {
      return NextResponse.json(
        {
          message:
            "Invalid twitterCoverMediaIndex: must be a non-negative integer or null",
        },
        { status: 400 },
      );
    }

    // Validate productCoverImageIndex field
    if (
      productCoverImageIndex !== undefined &&
      productCoverImageIndex !== null &&
      (typeof productCoverImageIndex !== "number" ||
        !Number.isInteger(productCoverImageIndex) ||
        productCoverImageIndex < 0)
    ) {
      return NextResponse.json(
        {
          message:
            "Invalid productCoverImageIndex: must be a non-negative integer or null",
        },
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
            {
              message:
                "Invalid userTags field: tags must be 50 characters or less",
            },
            { status: 400 },
          );
        }
        if (!tagRegex.test(tag)) {
          return NextResponse.json(
            {
              message:
                "Invalid userTags field: tags can only contain letters, numbers, spaces, hyphens, and underscores",
            },
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

    // `kind` is intentionally not updatable here: changing an item's kind
    // requires re-running enrichment and pruning stale detail rows, which the
    // dedicated reassign endpoint (POST /api/v1/items/[id]/reassign) handles.
    const filterRelevantFieldsChanged =
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
        ...(coverFileKey !== undefined && { coverFileKey }),
        ...(excludeFromPublicRooms !== undefined && { excludeFromPublicRooms }),
        ...(tags !== undefined && { tags }),
        ...(userTags !== undefined && { userTags }),
        // Mark the title as user-owned so re-analysis won't overwrite it
        ...(title !== undefined && { title, titleEditedByUser: true }),
        ...(notes !== undefined && { notes }),
        // `shared` toggles direct-link sharing. Preserve the original
        // sharedAt while it stays shared; clear it on un-share.
        ...(shared !== undefined && {
          sharedAt: shared ? (existingItem.sharedAt ?? new Date()) : null,
        }),
        ...(sharedHighlights !== undefined && { sharedHighlights }),
      },
      select: {
        id: true,
        userId: true,
        kind: true,
        processingStatus: true,
        processingError: true,
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
        sharedAt: true,
        sharedHighlights: true,
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
        noteDetails: {
          select: {
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

    // Update note body content if provided (upsert so older notes still gain a row)
    if (content !== undefined) {
      await db.itemNoteDetails.upsert({
        where: { itemId: id },
        create: { itemId: id, content },
        update: { content },
      });
    }

    // Update twitter cover media index if provided
    if (twitterCoverMediaIndex !== undefined) {
      await db.itemTwitterDetails.updateMany({
        where: { itemId: id },
        data: { coverMediaIndex: twitterCoverMediaIndex },
      });
    }

    // Update product cover image index and sync coverFileKey
    if (productCoverImageIndex !== undefined) {
      const productDetails = await db.itemProductDetails.findFirst({
        where: { itemId: id },
        select: { images: true },
      });

      await db.itemProductDetails.updateMany({
        where: { itemId: id },
        data: { coverImageIndex: productCoverImageIndex },
      });

      if (productDetails?.images && productCoverImageIndex !== null) {
        const images = productDetails.images as Array<{ fileKey?: string }>;
        const selectedImage = images[productCoverImageIndex];
        if (selectedImage?.fileKey) {
          await db.item.update({
            where: { id },
            data: { coverFileKey: selectedImage.fileKey },
          });
        }
      }
    }

    // Trigger room sync if filter-relevant fields changed
    if (filterRelevantFieldsChanged) {
      await tasks.trigger<typeof syncItemToRoomsTask>("sync-item-to-rooms", {
        itemId: id,
        userId: user.id,
      });
    }

    // Log activity (fire-and-forget)
    void logActivity(user.id, "item_update", { itemId: id });

    // Mark milestone if user added their first tag
    if (shouldCompleteAddFirstTag(userTags)) {
      void markMilestoneComplete(user.id, "add_first_tag");
    }

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
