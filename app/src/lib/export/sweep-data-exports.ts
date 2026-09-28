import type { SupabaseClient } from "@supabase/supabase-js";
import db from "@/lib/db";
import { STORAGE_PAGE_SIZE } from "@/lib/storage-objects";
import {
  EXPORT_FAILED_MESSAGE,
  EXPORTS_BUCKET,
  STRANDED_EXPORT_MS,
} from "./constants";

/**
 * Housekeeping for data exports, run on a schedule:
 * - Deletes the archives of exports past `expiresAt` and marks them expired.
 *   A row only flips once its file is confirmed removed, so a storage error
 *   is retried by the next sweep rather than leaking the archive.
 * - Fails runs stranded in pending/exporting (dropped from the queue or
 *   killed), which would otherwise block the user from exporting again.
 */
export async function sweepDataExports({
  supabase,
  now = new Date(),
}: {
  supabase: Pick<SupabaseClient, "storage">;
  now?: Date;
}): Promise<{ expired: number; stranded: number }> {
  let expired = 0;
  for (;;) {
    const due = await db.dataExport.findMany({
      where: { status: "completed", expiresAt: { lte: now } },
      select: { id: true, fileKey: true },
      take: STORAGE_PAGE_SIZE,
    });
    if (due.length === 0) break;

    const fileKeys = due
      .map(({ fileKey }) => fileKey)
      .filter((key): key is string => key !== null);
    if (fileKeys.length > 0) {
      const { error } = await supabase.storage
        .from(EXPORTS_BUCKET)
        .remove(fileKeys);
      if (error) throw error;
    }

    const { count } = await db.dataExport.updateMany({
      where: { id: { in: due.map(({ id }) => id) } },
      data: { status: "expired", fileKey: null },
    });
    expired += count;
    if (due.length < STORAGE_PAGE_SIZE) break;
  }

  const { count: stranded } = await db.dataExport.updateMany({
    where: {
      status: { in: ["pending", "exporting"] },
      createdAt: { lt: new Date(now.getTime() - STRANDED_EXPORT_MS) },
    },
    data: { status: "failed", error: EXPORT_FAILED_MESSAGE },
  });

  return { expired, stranded };
}
