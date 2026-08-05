import type { analyzeImageTask } from "@app/trigger/analyze-image";
import type { classifyUrlTask } from "@app/trigger/classify-url";
import type { ProcessingErrorReason } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { hasFullAdminAccess } from "@/lib/admin/auth";
import db from "@/lib/db";
import { enqueueUserProcessing } from "@/lib/items/enqueue-user-processing";
import { claimFailedRetry } from "@/lib/items/retry-claim";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";
import { guardDailyLimit } from "@/lib/usage-limits";

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
        processingStartedAt: true,
        fileKey: true,
        sourceType: true,
        sourceUrl: true,
      },
    });

    if (!item) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    if (!isAdmin) {
      if (item.processingStatus === "completed") {
        return NextResponse.json({
          success: true,
          message: "Item already processed",
          processingStatus: "completed",
        });
      }
      if (item.processingStatus !== "failed") {
        return NextResponse.json(
          { message: "Item is still processing" },
          { status: 400 },
        );
      }
    }

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

    if (!isAdmin) {
      const claimed = await claimFailedRetry(id, user.id);
      if (!claimed) {
        return NextResponse.json({
          success: true,
          message: "Retry already in progress",
          processingStatus: "processing",
        });
      }
    } else {
      await db.item.update({
        where: { id },
        data: {
          processingStatus: "processing",
          processingError: null,
          // Restart the reaper clock for this fresh attempt
          processingStartedAt: new Date(),
        },
      });
    }

    const previousStatus = item.processingStatus;
    const previousProcessingStartedAt = item.processingStartedAt;
    // Restore both status AND the reaper clock — the admin claim bumped
    // processingStartedAt, and a failed retry must leave an already-stuck item
    // eligible for the sweep at its original time, not a fresh 4h window.
    // `processingError` stamps a reason when reverting to `failed` (enqueue
    // failure) so it doesn't render as a bare "unknown".
    const revert = (processingError?: ProcessingErrorReason) =>
      db.item.update({
        where: { id },
        data: {
          processingStatus: previousStatus,
          processingStartedAt: previousProcessingStartedAt,
          ...(processingError ? { processingError } : {}),
        },
      });

    const guard = await guardDailyLimit(user.id, "reanalysis");
    if (!guard.ok) {
      await revert();
      return NextResponse.json(
        { message: "Daily limit reached" },
        {
          status: 429,
          headers: { "Retry-After": String(guard.check.retryAfterSeconds) },
        },
      );
    }

    try {
      if (item.sourceType === "url" && item.sourceUrl) {
        log.info(
          { itemId: id, userId: item.userId, triggeredBy: user.id },
          "Retrying URL classification",
        );
        await enqueueUserProcessing<typeof classifyUrlTask>(
          "classify-url",
          {
            itemId: id,
            userId: item.userId,
            url: item.sourceUrl,
          },
          item.userId,
        );
      } else if (item.kind === "image" && item.fileKey) {
        log.info(
          { itemId: id, userId: item.userId, triggeredBy: user.id },
          "Retrying image analysis",
        );
        await enqueueUserProcessing<typeof analyzeImageTask>(
          "analyze-image",
          {
            itemId: id,
            userId: item.userId,
            fileKey: item.fileKey,
          },
          item.userId,
        );
      }
    } catch (triggerError) {
      log.error({ triggerError, itemId: id }, "Failed to trigger retry task");
      // Only a revert back to `failed` gets the reason stamped; a non-failed
      // previous status (admin retrying a processing/completed item) reverts clean.
      await revert(previousStatus === "failed" ? "enqueue_failed" : undefined);
      captureServerException(triggerError, undefined, {
        route: "POST /api/v1/items/[id]/retry",
        stage: "trigger:retry",
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
    captureServerException(error, undefined, {
      route: "POST /api/v1/items/[id]/retry",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
