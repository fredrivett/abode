/** Statuses of an import still running; a user may have only one at a time */
export const ACTIVE_IMPORT_STATUSES = ["pending", "importing"] as const;

/** How long one import-literal-books chunk may run (seconds) */
export const IMPORT_CHUNK_MAX_DURATION_S = 10 * 60;

/**
 * An import still pending/importing after this long will never finish: every
 * chunk is queued when the import starts, so past the project's 2h queue TTL
 * plus a chunk's maxDuration each one has run or been dropped/killed. The sweep
 * fails it so it stops blocking new imports (one active per user).
 */
export const STRANDED_IMPORT_MS =
  2 * 60 * 60 * 1000 + IMPORT_CHUNK_MAX_DURATION_S * 1000 + 60 * 60 * 1000;

/** User-facing failure summary stored on a stranded import (never raw errors) */
export const IMPORT_FAILED_MESSAGE = "Import could not be completed";
