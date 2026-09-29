/** Private storage bucket holding export archives (service role only) */
export const EXPORTS_BUCKET = "exports";

/** How long a finished export stays downloadable before it's deleted */
export const EXPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Exports a user can request per rolling 24 hours */
export const MAX_EXPORTS_PER_DAY = 3;

/** How long the download redirect's signed URL is valid for */
export const DOWNLOAD_URL_TTL_SECONDS = 60;

/** How long the export-user-data task may run (seconds) */
export const EXPORT_TASK_MAX_DURATION_S = 60 * 60;

/**
 * A run still pending/exporting after this long will never finish: past the
 * project's 2h queue TTL plus the task's maxDuration it was dropped or killed.
 * The sweep fails it so it stops blocking new exports (one active per user).
 */
export const STRANDED_EXPORT_MS =
  2 * 60 * 60 * 1000 + EXPORT_TASK_MAX_DURATION_S * 1000 + 60 * 60 * 1000;

/** Default largest ZIP part, before files spill into the next part (1 GiB) */
export const DEFAULT_EXPORT_PART_MB = 1024;

/**
 * Largest ZIP part in bytes. Each part is one storage upload, so it must stay
 * under the Supabase project's upload size limit: set `DATA_EXPORT_PART_MB`
 * lower if your limit is smaller than the 1 GiB default. Read from process.env
 * directly (not env.server) so the Trigger task can import it.
 */
export function exportPartMaxBytes(): number {
  const mb = Number(process.env.DATA_EXPORT_PART_MB);
  return (
    (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_EXPORT_PART_MB) * 1024 * 1024
  );
}

/** Storage key of one part of an export */
export function exportPartKey({
  userId,
  exportId,
  position,
}: {
  userId: string;
  exportId: string;
  position: number;
}): string {
  return `${userId}/${exportId}/part-${position}.zip`;
}

/**
 * Filename a part downloads as: `abode-export-2026-09-28.zip`, or
 * `abode-export-2026-09-28-part-2-of-3.zip` when the export was split.
 */
export function exportDownloadFilename({
  completedAt,
  position,
  partCount,
}: {
  completedAt: Date;
  position: number;
  partCount: number;
}): string {
  const date = completedAt.toISOString().slice(0, 10);
  const part = partCount > 1 ? `-part-${position}-of-${partCount}` : "";
  return `abode-export-${date}${part}.zip`;
}

/** User-facing failure summary stored on a failed export (never raw errors) */
export const EXPORT_FAILED_MESSAGE =
  "The export couldn't be completed. Please try again.";
