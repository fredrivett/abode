import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import db from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { getDataExportReadyEmail } from "@/lib/email/templates";
import { createLogger } from "@/lib/logger.server";
import { captureServerException, getPostHogClient } from "@/lib/posthog-server";
import { getAppBaseUrl } from "@/lib/url";
import { buildExportArchive, type ExportFileSource } from "./build-export";
import {
  EXPORT_FAILED_MESSAGE,
  EXPORT_RETENTION_MS,
  EXPORTS_BUCKET,
  exportPartKey,
  exportPartMaxBytes,
} from "./constants";

const log = createLogger("lib/export/run-data-export");

// A transient storage blip shouldn't turn a file into a "missing" one
const DOWNLOAD_ATTEMPTS = 2;

type Storage = Pick<SupabaseClient, "storage">;

export type RunDataExportResult =
  | {
      status: "completed";
      itemCount: number;
      fileCount: number;
      missingFileCount: number;
      partCount: number;
      sizeBytes: number;
    }
  | { status: "skipped" };

async function downloadStoredFile(
  supabase: Storage,
  { bucket, key }: ExportFileSource,
): Promise<Uint8Array | null> {
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
    const { data, error } = await supabase.storage.from(bucket).download(key);
    if (data) return new Uint8Array(await data.arrayBuffer());
    log.warn({ bucket, key, attempt, error }, "Export file download failed");
  }
  return null;
}

/**
 * Builds a requested export and stores it for download: claims the pending
 * row (so a duplicate run is a no-op), builds the archive on local disk part
 * by part, streams each part to the private exports bucket as it's finished,
 * then records the parts and marks the row completed with a 7-day expiry.
 * Any failure deletes the parts already uploaded, marks the row failed (with a
 * safe message) and rethrows. The ready email and analytics are best-effort
 * once the export is safely stored.
 */
export async function runDataExport({
  exportId,
  supabase,
}: {
  exportId: string;
  supabase: Storage;
}): Promise<RunDataExportResult> {
  const claimed = await db.dataExport.updateMany({
    where: { id: exportId, status: "pending" },
    data: { status: "exporting" },
  });
  if (claimed.count === 0) return { status: "skipped" };

  const startedAt = Date.now();
  const uploaded: { position: number; fileKey: string; sizeBytes: number }[] =
    [];
  let workDir: string | null = null;
  let userId: string;
  let email: string;
  let result: Extract<RunDataExportResult, { status: "completed" }>;
  let expiresAt: Date;

  try {
    const row = await db.dataExport.findUniqueOrThrow({
      where: { id: exportId },
      select: { userId: true, user: { select: { email: true } } },
    });
    userId = row.userId;
    email = row.user.email;
    workDir = await mkdtemp(join(tmpdir(), "abode-export-"));

    const exportedAt = new Date();
    const archive = await buildExportArchive({
      userId,
      exportedAt,
      instanceUrl: getAppBaseUrl(),
      workDir,
      maxPartBytes: exportPartMaxBytes(),
      downloadFile: (file) => downloadStoredFile(supabase, file),
      onPart: async (part) => {
        const fileKey = exportPartKey({
          userId,
          exportId,
          position: part.position,
        });
        const { error } = await supabase.storage
          .from(EXPORTS_BUCKET)
          .upload(fileKey, createReadStream(part.path), {
            contentType: "application/zip",
            upsert: true,
          });
        if (error) throw error;
        uploaded.push({
          position: part.position,
          fileKey,
          sizeBytes: part.sizeBytes,
        });
        await rm(part.path, { force: true });
      },
    });

    const sizeBytes = uploaded.reduce((total, p) => total + p.sizeBytes, 0);
    expiresAt = new Date(exportedAt.getTime() + EXPORT_RETENTION_MS);
    await db.$transaction([
      db.dataExportPart.createMany({
        data: uploaded.map((part) => ({
          exportId,
          position: part.position,
          fileKey: part.fileKey,
          sizeBytes: BigInt(part.sizeBytes),
        })),
      }),
      db.dataExport.update({
        where: { id: exportId },
        data: {
          status: "completed",
          sizeBytes: BigInt(sizeBytes),
          itemCount: archive.itemCount,
          fileCount: archive.fileCount,
          completedAt: exportedAt,
          expiresAt,
        },
      }),
    ]);
    result = {
      status: "completed",
      itemCount: archive.itemCount,
      fileCount: archive.fileCount,
      missingFileCount: archive.missingFileCount,
      partCount: uploaded.length,
      sizeBytes,
    };
  } catch (error) {
    if (uploaded.length > 0) {
      await supabase.storage
        .from(EXPORTS_BUCKET)
        .remove(uploaded.map(({ fileKey }) => fileKey))
        .catch(() => {});
    }
    await db.dataExport
      .update({
        where: { id: exportId },
        data: { status: "failed", error: EXPORT_FAILED_MESSAGE },
      })
      .catch(() => {});
    throw error;
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }

  getPostHogClient()?.capture({
    distinctId: userId,
    event: "data_export_completed",
    properties: {
      item_count: result.itemCount,
      file_count: result.fileCount,
      missing_file_count: result.missingFileCount,
      part_count: result.partCount,
      size_bytes: result.sizeBytes,
      duration_ms: Date.now() - startedAt,
    },
  });

  if (isEmailConfigured()) {
    try {
      const sent = await sendEmail({
        to: email,
        ...getDataExportReadyEmail({ itemCount: result.itemCount, expiresAt }),
      });
      // Provider failures come back as a result, not an exception
      if (!sent.success) throw new Error(sent.error ?? "Email not sent");
    } catch (error) {
      log.warn({ error, exportId }, "Failed to send export-ready email");
      captureServerException(error, userId, { context: "data_export_email" });
    }
  }

  return result;
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
