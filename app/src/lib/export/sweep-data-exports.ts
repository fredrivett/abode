import type { SupabaseClient } from "@supabase/supabase-js";
import db from "@/lib/db";
import {
  removeAllObjectsUnderPrefix,
  STORAGE_PAGE_SIZE,
} from "@/lib/storage-objects";

// Expired exports handled per round (each can have several parts)
const EXPIRE_BATCH_SIZE = 100;

import {
  EXPORT_FAILED_MESSAGE,
  EXPORTS_BUCKET,
  exportPrefix,
  STRANDED_EXPORT_MS,
} from "./constants";

/**
 * Housekeeping for data exports, run on a schedule:
 * - Deletes every part of exports past `expiresAt` and marks them expired.
 *   A row only flips once its parts are confirmed removed, so a storage error
 *   is retried by the next sweep rather than leaking the archive.
 * - Fails runs stranded in pending/exporting (dropped from the queue or
 *   killed), which would otherwise block the user from exporting again,
 *   deleting any parts they'd uploaded before dying.
 */
export async function sweepDataExports({
  supabase,
  now = new Date(),
}: {
  supabase: Pick<SupabaseClient, "storage">;
  now?: Date;
}): Promise<{ expired: number; stranded: number }> {
  let expired = 0;
  let expiryError: unknown = null;
  try {
    for (;;) {
      const due = await db.dataExport.findMany({
        where: { status: "completed", expiresAt: { lte: now } },
        select: { id: true, parts: { select: { fileKey: true } } },
        take: EXPIRE_BATCH_SIZE,
      });
      if (due.length === 0) break;

      const fileKeys = due.flatMap(({ parts }) =>
        parts.map(({ fileKey }) => fileKey),
      );
      for (let i = 0; i < fileKeys.length; i += STORAGE_PAGE_SIZE) {
        const { error } = await supabase.storage
          .from(EXPORTS_BUCKET)
          .remove(fileKeys.slice(i, i + STORAGE_PAGE_SIZE));
        if (error) throw error;
      }

      const ids = due.map(({ id }) => id);
      const [, { count }] = await db.$transaction([
        db.dataExportPart.deleteMany({ where: { exportId: { in: ids } } }),
        db.dataExport.updateMany({
          where: { id: { in: ids } },
          data: { status: "expired" },
        }),
      ]);
      expired += count;
      if (due.length < EXPIRE_BATCH_SIZE) break;
    }
  } catch (error) {
    // Still release stranded runs below; one bad archive mustn't block exports
    expiryError = error;
  }

  // A run killed mid-export may have uploaded parts before any were recorded;
  // they sit under its own folder, so clear that before failing it
  const strandedRuns = await db.dataExport.findMany({
    where: {
      status: { in: ["pending", "exporting"] },
      createdAt: { lt: new Date(now.getTime() - STRANDED_EXPORT_MS) },
    },
    select: { id: true, userId: true },
  });
  for (const { id, userId } of strandedRuns) {
    try {
      await removeAllObjectsUnderPrefix(
        supabase.storage.from(EXPORTS_BUCKET),
        exportPrefix({ userId, exportId: id }),
      );
    } catch (error) {
      expiryError ??= error;
    }
  }
  const { count: stranded } = await db.dataExport.updateMany({
    where: {
      id: { in: strandedRuns.map(({ id }) => id) },
      status: { in: ["pending", "exporting"] },
    },
    data: { status: "failed", error: EXPORT_FAILED_MESSAGE },
  });

  if (expiryError) throw expiryError;
  return { expired, stranded };
}
