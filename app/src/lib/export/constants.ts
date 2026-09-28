/** Private storage bucket holding export archives (service role only) */
export const EXPORTS_BUCKET = "exports";

/** How long a finished export stays downloadable before it's deleted */
export const EXPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Exports a user can request per rolling 24 hours */
export const MAX_EXPORTS_PER_DAY = 3;

/** How long the download redirect's signed URL is valid for */
export const DOWNLOAD_URL_TTL_SECONDS = 60;

/**
 * A run still pending/exporting after this long will never finish: past the
 * project's 2h queue TTL plus the task's maxDuration it was dropped or killed.
 * The sweep fails it so it stops blocking new exports (one active per user).
 */
export const STRANDED_EXPORT_MS = 3 * 60 * 60 * 1000;

/** Storage key of an export's archive */
export function exportFileKey({
  userId,
  exportId,
}: {
  userId: string;
  exportId: string;
}): string {
  return `${userId}/${exportId}.zip`;
}

/** Filename the archive downloads as, e.g. `abode-export-2026-09-28.zip` */
export function exportDownloadFilename(completedAt: Date): string {
  return `abode-export-${completedAt.toISOString().slice(0, 10)}.zip`;
}

/** User-facing failure summary stored on a failed export (never raw errors) */
export const EXPORT_FAILED_MESSAGE =
  "The export couldn't be completed. Please try again.";
