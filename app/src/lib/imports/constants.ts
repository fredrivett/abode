/** Statuses of an import still running; a user may have only one at a time */
export const ACTIVE_IMPORT_STATUSES = ["pending", "importing"] as const;

/** How long one import-literal-books chunk may run (seconds) */
export const IMPORT_CHUNK_MAX_DURATION_S = 10 * 60;
