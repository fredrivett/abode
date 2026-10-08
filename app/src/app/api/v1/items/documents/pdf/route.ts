import { type NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import db from "@/lib/db";
import {
  createPdfDocumentSchema,
  titleFromFileName,
} from "@/lib/documents/create-pdf-document-schema";
import { dailyLimitResponse } from "@/lib/http/daily-limit";
import { zodErrorResponse } from "@/lib/http/zod-error";
import { enqueuePdfImport } from "@/lib/items/enqueue-pdf-import";
import { createLogger } from "@/lib/logger.server";
import { captureServerException } from "@/lib/posthog-server";
import { createClient, getUserWithMfa } from "@/lib/supabase/server";
import { PDF_MIME_TYPE } from "@/lib/uploads";
import { guardDailyLimit } from "@/lib/usage-limits";

const log = createLogger("api/v1/items/documents/pdf");

/**
 * POST /api/v1/items/documents/pdf
 *
 * Saves a PDF the client has already uploaded to storage as a `document` item,
 * then enqueues the import that renders its pages and analyses it. Counts one
 * ingestion action; the import counts each scanned page it OCRs (see
 * import-pdf), since the page count isn't known until the PDF is opened.
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

    const parsed = createPdfDocumentSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { fileKey, originalName, size } = parsed.data;

    if (!fileKey.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { message: "The file must be in the user's folder" },
        { status: 400 },
      );
    }

    const guard = await guardDailyLimit(user.id, "ingestion");
    if (!guard.ok) {
      return dailyLimitResponse(guard.check.retryAfterSeconds);
    }

    const item = await db.$transaction(async (tx) => {
      const created = await tx.item.create({
        data: {
          kind: "document",
          // The cover (page 1's image) is set once the import renders it
          sourceFileKey: fileKey,
          title: titleFromFileName(originalName),
          meta: { originalName, size, type: PDF_MIME_TYPE },
          sourceType: "upload",
          captureSource: "web",
          userId: user.id,
          processingStatus: "processing",
          // Like scans, PDFs are often personal (statements, contracts): keep
          // them out of public rooms unless the owner opts one in
          excludeFromPublicRooms: true,
        },
        select: { id: true, kind: true, processingStatus: true },
      });
      await tx.user.update({
        where: { id: user.id },
        data: {
          itemCount: { increment: 1 },
          storageUsedBytes: { increment: size },
        },
      });
      return created;
    });

    // The document is committed; an enqueue failure marks it failed (Retry)
    // rather than failing the request
    await enqueuePdfImport({ itemId: item.id, userId: user.id });
    void logActivity(user.id, "item_create", {
      itemId: item.id,
      kind: "document",
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    log.error({ error }, "PDF document creation error");
    captureServerException(error, undefined, {
      route: "POST /api/v1/items/documents/pdf",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
