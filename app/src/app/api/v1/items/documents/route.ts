import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import db from "@/lib/db";
import {
  createDocumentSchema,
  documentFileKeys,
} from "@/lib/documents/create-document-schema";
import { dailyLimitResponse } from "@/lib/http/daily-limit";
import { zodErrorResponse } from "@/lib/http/zod-error";
import { enqueueDocumentAnalysis } from "@/lib/items/enqueue-document-analysis";
import { createLogger } from "@/lib/logger.server";
import { markMilestoneComplete } from "@/lib/milestones";
import { captureServerException } from "@/lib/posthog-server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";
import { guardDailyLimit } from "@/lib/usage-limits";

const log = createLogger("api/v1/items/documents");

/**
 * POST /api/v1/items/documents
 *
 * Saves a scanned document whose page images the client has already uploaded
 * to storage: creates the `document` item and its pages, then enqueues OCR +
 * cover analysis. Counts one ingestion action per page.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await getUserWithMfa(supabase);
    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const parsed = createDocumentSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { pages, blurDataUrl } = parsed.data;

    const keys = documentFileKeys(pages);
    if (keys.some((key) => !key.startsWith(`${user.id}/`))) {
      return NextResponse.json(
        { message: "Page files must be in the user's folder" },
        { status: 400 },
      );
    }

    // Every page is OCR'd, so each counts against the daily allowance
    const guard = await guardDailyLimit(user.id, "ingestion", {
      weight: pages.length,
    });
    if (!guard.ok) {
      return dailyLimitResponse(guard.check.retryAfterSeconds);
    }

    const cover = pages[0];
    const size = pages.reduce((total, page) => total + page.size, 0);
    const meta: Prisma.InputJsonValue = {
      type: "image/jpeg",
      width: cover.width,
      height: cover.height,
      size,
      pageCount: pages.length,
      ...(blurDataUrl ? { blurDataUrl } : {}),
    };

    const item = await db.$transaction(async (tx) => {
      const created = await tx.item.create({
        data: {
          kind: "document",
          fileKey: cover.fileKey,
          meta,
          sourceType: "upload",
          captureSource: "web",
          userId: user.id,
          processingStatus: "processing",
          // Scans are often personal (letters, bills, forms): keep them out
          // of public rooms unless the owner opts a document in
          excludeFromPublicRooms: true,
        },
        select: { id: true, kind: true, processingStatus: true },
      });
      await tx.itemDocumentPage.createMany({
        data: pages.map((page, position) => ({
          itemId: created.id,
          position,
          fileKey: page.fileKey,
          originalFileKey: page.originalFileKey,
          filter: page.filter,
          width: page.width,
          height: page.height,
        })),
      });
      await tx.user.update({
        where: { id: user.id },
        data: {
          itemCount: { increment: 1 },
          ...(size > 0 && { storageUsedBytes: { increment: size } }),
        },
      });
      return created;
    });

    // The document is committed; an enqueue failure marks it failed (Retry)
    // rather than failing the request
    await enqueueDocumentAnalysis({ itemId: item.id, userId: user.id });
    void logActivity(user.id, "item_create", {
      itemId: item.id,
      kind: "document",
    });
    void markMilestoneComplete(user.id, "scan_first_document");

    return NextResponse.json(
      { ...item, pageCount: pages.length },
      { status: 201 },
    );
  } catch (error) {
    log.error({ error }, "Document creation error");
    captureServerException(error, undefined, {
      route: "POST /api/v1/items/documents",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
