import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import db from "@/lib/db";
import { zodErrorResponse } from "@/lib/http/zod-error";
import { itemSelect, transformItem } from "@/lib/items/query";
import { createLogger } from "@/lib/logger.server";
import { markMilestoneComplete } from "@/lib/milestones";
import {
  shouldCompleteAddFirstTag,
  shouldCompleteSeeAiAnalysis,
} from "@/lib/milestones/conditions";
import { captureServerException } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";
import { resolveTweetCoverFileKey } from "@/lib/twitter/cover";
import type { TwitterMedia } from "@/lib/types/item";
import type { analyzeMediaCoverTask } from "../../../../../../trigger/analyze-media-cover";
import type { syncItemToRoomsTask } from "../../../../../../trigger/sync-item-to-rooms";
import { itemPatchSchema } from "./schema";

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
      select: itemSelect,
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

    return NextResponse.json(transformItem(item));
  } catch (error) {
    log.error({ error }, "Item fetch error");
    captureServerException(error, undefined, {
      route: "GET /api/v1/items/[id]",
    });
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
    const parsed = itemPatchSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }
    const {
      notes,
      shared,
      sharedHighlights,
      content,
      twitterCoverMediaIndex,
      productCoverImageIndex,
      userTags,
    } = parsed.data;
    // Fields without dedicated validation pass through unchanged from the raw
    // body, preserving prior behavior (they were never validated here).
    const {
      processingStatus,
      fileKey,
      meta,
      sourceType,
      sourceUrl,
      coverFileKey,
      excludeFromPublicRooms,
      tags,
      title,
    } = body;

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
      select: itemSelect,
    });

    // Update note body content if provided (upsert so older notes still gain a row)
    if (content !== undefined) {
      await db.itemNoteDetails.upsert({
        where: { itemId: id },
        create: { itemId: id, content },
        update: { content },
      });
    }

    // Update twitter cover media index, re-point coverFileKey to the selected
    // image, and (re)analyse it so search + similar-images follow the chosen
    // cover (analyze-media-cover re-mirrors from cache if already analysed).
    if (twitterCoverMediaIndex !== undefined) {
      await db.itemTwitterDetails.updateMany({
        where: { itemId: id },
        data: { coverMediaIndex: twitterCoverMediaIndex },
      });
      // updatedItem was read before this update, so reflect the new index
      if (updatedItem.twitterDetails) {
        updatedItem.twitterDetails.coverMediaIndex = twitterCoverMediaIndex;
      }

      const details = await db.itemTwitterDetails.findFirst({
        where: { itemId: id },
        select: { media: true, text: true },
      });
      const media = details?.media as TwitterMedia[] | null;
      const newCoverFileKey = resolveTweetCoverFileKey(
        media,
        twitterCoverMediaIndex,
      );

      if (newCoverFileKey) {
        await db.item.update({
          where: { id },
          data: { coverFileKey: newCoverFileKey },
        });
        // Reflect the swap in the response — updatedItem was read before this
        // second update, so it still holds the pre-swap coverFileKey
        updatedItem.coverFileKey = newCoverFileKey;
        await tasks.trigger<typeof analyzeMediaCoverTask>(
          "analyze-media-cover",
          {
            itemId: id,
            userId: user.id,
            fileKey: newCoverFileKey,
            extraSourceText: details?.text ?? undefined,
          },
        );
      }
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
      // updatedItem was read before this update, so reflect the new index
      if (updatedItem.productDetails) {
        updatedItem.productDetails.coverImageIndex = productCoverImageIndex;
      }

      if (productDetails?.images && productCoverImageIndex !== null) {
        const images = productDetails.images as Array<{ fileKey?: string }>;
        const selectedImage = images[productCoverImageIndex];
        if (selectedImage?.fileKey) {
          await db.item.update({
            where: { id },
            data: { coverFileKey: selectedImage.fileKey },
          });
          // Reflect the swap in the response (read before this second update)
          updatedItem.coverFileKey = selectedImage.fileKey;
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

    return NextResponse.json(transformItem(updatedItem));
  } catch (error) {
    log.error({ error }, "Item update error");
    captureServerException(error, undefined, {
      route: "PATCH /api/v1/items/[id]",
    });
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
    captureServerException(error, undefined, {
      route: "DELETE /api/v1/items/[id]",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
