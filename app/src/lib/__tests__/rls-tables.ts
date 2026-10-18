/**
 * How each table relates to the restricted abode_app role, beyond the default
 * (owner-only policies). Shared by rls-coverage and rls-policies, so adding a
 * table here updates both.
 */

/** abode_app can never read these: system-only data, or Prisma's ledger */
export const SYSTEM_ONLY_TABLES = new Set([
  "_prisma_migrations",
  "waitlist_entries",
]);

/** Readable by every viewer (`USING (true)`): they hold no user data */
export const SHARED_TABLES = new Set(["visual_embedding_stats"]);
