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

/**
 * Default largest ZIP part in MiB. Each part is one storage upload, and
 * Supabase's default global upload limit (and the ceiling while a project's
 * spend cap is on) is 50 MB, so this leaves headroom under it.
 */
export const DEFAULT_EXPORT_PART_MB = 45;

/**
 * Largest ZIP part in bytes. It must stay under the Supabase project's global
 * upload size limit; raise `DATA_EXPORT_PART_MB` (in the Trigger.dev task's
 * env, where exports are built) after raising that limit, for fewer, bigger
 * parts. Read from process.env directly (not env.server) so the Trigger task
 * can import it.
 */
export function exportPartMaxBytes(): number {
  const mb = Number(process.env.DATA_EXPORT_PART_MB);
  return (
    (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_EXPORT_PART_MB) * 1024 * 1024
  );
}

/** Storage folder holding all of an export's parts */
export function exportPrefix({
  userId,
  exportId,
}: {
  userId: string;
  exportId: string;
}): string {
  return `${userId}/${exportId}`;
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
  return `${exportPrefix({ userId, exportId })}/part-${position}.zip`;
}

/**
 * Top-level folder a part unzips to. Every entry of a part sits inside it, so
 * each part extracts to its own clearly named folder (tools like macOS Archive
 * Utility otherwise dump a later part's bare `files/` folder next to the
 * others as `files 2`, `files 3`…). Part 1, which carries the data, is the
 * main folder; later parts are numbered. The total isn't known while part 1
 * is written, so unlike the download filename it isn't "part N of M".
 */
export function exportFolderName({
  exportedAt,
  position,
}: {
  exportedAt: Date;
  position: number;
}): string {
  const date = exportedAt.toISOString().slice(0, 10);
  return position === 1
    ? `abode-export-${date}`
    : `abode-export-${date}-part-${position}`;
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
