import type { SupabaseClient } from "@supabase/supabase-js";
import db from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { getDataExportReadyEmail } from "@/lib/email/templates";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { getAppBaseUrl } from "@/lib/url";
import { buildExportArchive } from "./build-export";
import {
  EXPORT_FAILED_MESSAGE,
  EXPORT_RETENTION_MS,
  EXPORTS_BUCKET,
  exportFileKey,
} from "./constants";

const log = createLogger("lib/export/run-data-export");

export type RunDataExportResult =
  | { status: "completed"; itemCount: number; sizeBytes: number }
  | { status: "skipped" };

/**
 * Builds a requested export and stores it for download: claims the pending
 * row (so a duplicate run is a no-op), builds the archive, uploads it to the
 * private exports bucket, and marks the row completed with a 7-day expiry.
 * Any failure marks the row failed (with a safe message) and rethrows. The
 * ready email and analytics are best-effort once the export is safely stored.
 */
export async function runDataExport({
  exportId,
  supabase,
}: {
  exportId: string;
  supabase: Pick<SupabaseClient, "storage">;
}): Promise<RunDataExportResult> {
  const claimed = await db.dataExport.updateMany({
    where: { id: exportId, status: "pending" },
    data: { status: "exporting" },
  });
  if (claimed.count === 0) return { status: "skipped" };

  const startedAt = Date.now();
  let userId: string;
  let email: string;
  let itemCount: number;
  let sizeBytes: number;
  let expiresAt: Date;
  let uploadedKey: string | null = null;
  try {
    const row = await db.dataExport.findUniqueOrThrow({
      where: { id: exportId },
      select: { userId: true, user: { select: { email: true } } },
    });
    userId = row.userId;
    email = row.user.email;

    const exportedAt = new Date();
    const archive = await buildExportArchive({
      userId,
      exportedAt,
      instanceUrl: getAppBaseUrl(),
    });
    itemCount = archive.itemCount;
    sizeBytes = archive.bytes.length;

    const fileKey = exportFileKey({ userId, exportId });
    const { error } = await supabase.storage
      .from(EXPORTS_BUCKET)
      .upload(fileKey, archive.bytes, {
        contentType: "application/zip",
        upsert: true,
      });
    if (error) throw error;
    uploadedKey = fileKey;

    expiresAt = new Date(exportedAt.getTime() + EXPORT_RETENTION_MS);
    await db.dataExport.update({
      where: { id: exportId },
      data: {
        status: "completed",
        fileKey,
        sizeBytes: BigInt(sizeBytes),
        itemCount,
        completedAt: exportedAt,
        expiresAt,
      },
    });
  } catch (error) {
    // A failed run is never swept, so don't leave its archive behind
    if (uploadedKey) {
      await supabase.storage
        .from(EXPORTS_BUCKET)
        .remove([uploadedKey])
        .catch(() => {});
    }
    await db.dataExport
      .update({
        where: { id: exportId },
        data: { status: "failed", error: EXPORT_FAILED_MESSAGE },
      })
      .catch(() => {});
    throw error;
  }

  getPostHogClient()?.capture({
    distinctId: userId,
    event: "data_export_completed",
    properties: {
      item_count: itemCount,
      size_bytes: sizeBytes,
      duration_ms: Date.now() - startedAt,
    },
  });

  if (isEmailConfigured()) {
    try {
      const sent = await sendEmail({
        to: email,
        ...getDataExportReadyEmail({ itemCount, expiresAt }),
      });
      // Provider failures come back as a result, not an exception
      if (!sent.success) throw new Error(sent.error ?? "Email not sent");
    } catch (error) {
      log.warn({ error, exportId }, "Failed to send export-ready email");
      captureServerException(error, userId, { context: "data_export_email" });
    }
  }

  return { status: "completed", itemCount, sizeBytes };
}

/**
 * Best-effort: fail an export that's still pending/exporting, for a run that
 * died before (or outside) runDataExport's own failure handling — e.g. the
 * worker lacks Supabase config — so it doesn't block the next request.
 */
export async function markDataExportFailed(exportId: string): Promise<void> {
  await db.dataExport
    .updateMany({
      where: { id: exportId, status: { in: ["pending", "exporting"] } },
      data: { status: "failed", error: EXPORT_FAILED_MESSAGE },
    })
    .catch(() => {});
}
