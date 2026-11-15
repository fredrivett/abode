const MIB = 1024 * 1024;

/**
 * Each storage bucket's per-object `file_size_limit` in MiB, as set by the
 * bucket migrations (supabase/migrations + prisma/migrations). Storage rejects
 * anything larger, so every cap on a path that uploads to a bucket derives from
 * these. storage-buckets.test.ts fails when a migration changes a limit without
 * this. Changing one here means a migration too.
 */
export const BUCKET_SIZE_LIMIT_MB = { items: 15, avatars: 2 } as const;

export const ITEMS_BUCKET_MAX_BYTES = BUCKET_SIZE_LIMIT_MB.items * MIB;
export const AVATARS_BUCKET_MAX_BYTES = BUCKET_SIZE_LIMIT_MB.avatars * MIB;
