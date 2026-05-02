import type { analyzeImageTask } from "@app/trigger/analyze-image";
import type { classifyUrlTask } from "@app/trigger/classify-url";
import { tasks } from "@trigger.dev/sdk";
import { type NextRequest, NextResponse } from "next/server";
import { hasFullAdminAccess } from "@/lib/admin/auth";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import { createClient } from "@/lib/supabase/server";

const log = createLogger("api/v1/items/[id]/retry");

export async function POST(
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

    const isAdmin = await hasFullAdminAccess(supabase);

    // Admins can retry any item; other users can only retry their own.
    const item = await db.item.findUnique({
      where: isAdmin ? { id } : { id, userId: user.id },
      select: {
        id: true,
        userId: true,
        kind: true,
        processingStatus: true,
        fileKey: true,
        sourceType: true,
        sourceUrl: true,
      },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    // Non-admins can only retry failed items; admins can re-trigger any item.
    if (!isAdmin && item.processingStatus !== "failed") {
      return NextResponse.json(
        { message: "Only failed items can be retried" },
        { status: 400 },
      );
    }

    // Check if this item type can be retried before updating status
    const canRetry =
      (item.sourceType === "url" && item.sourceUrl) ||
      (item.kind === "image" && item.fileKey);

    if (!canRetry) {
      log.warn(
        { itemId: id, kind: item.kind, sourceType: item.sourceType },
        "Cannot retry item: unknown type or missing required fields",
      );
      return NextResponse.json(
        { message: "Cannot retry this item type" },
        { status: 400 },
      );
    }

    // Set status back to processing
    await db.item.update({
      where: { id },
      data: { processingStatus: "processing" },
    });

    // Trigger the appropriate task using the item owner's userId
    // (admins can retry on behalf of other users).
    try {
      if (item.sourceType === "url" && item.sourceUrl) {
        // URL items need to be re-classified (could be image or article)
        log.info(
          { itemId: id, userId: item.userId, triggeredBy: user.id },
          "Retrying URL classification",
        );
        await tasks.trigger<typeof classifyUrlTask>("classify-url", {
          itemId: id,
          userId: item.userId,
          url: item.sourceUrl,
        });
      } else if (item.kind === "image" && item.fileKey) {
        // Direct image upload - run image analysis
        log.info(
          { itemId: id, userId: item.userId, triggeredBy: user.id },
          "Retrying image analysis",
        );
        await tasks.trigger<typeof analyzeImageTask>("analyze-image", {
          itemId: id,
          userId: item.userId,
          fileKey: item.fileKey,
        });
      }
    } catch (triggerError) {
      log.error({ triggerError, itemId: id }, "Failed to trigger retry task");
      // Revert status so the user can try again
      await db.item.update({
        where: { id },
        data: { processingStatus: "failed" },
      });
      return NextResponse.json(
        { message: "Failed to initiate retry" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Retry initiated",
      processingStatus: "processing",
    });
  } catch (error) {
    log.error({ error }, "Item retry error");
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
