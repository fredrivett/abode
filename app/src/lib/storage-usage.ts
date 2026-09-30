import { Prisma } from "@prisma/client";
import db from "@/lib/db";
import { LIBRARY_BUCKETS } from "@/lib/storage-objects";

/**
 * Bytes each user actually has in storage, summed from Supabase Storage's own
 * object metadata across their library folders (item files and avatars — not
 * export archives, which are temporary copies of the same data).
 *
 * This is the source of truth the daily reconcile resets `storageUsedBytes` to.
 * The per-item `meta.size`/`meta.coverSize` the counters move by in between
 * only cover the upload and the cover, so summing those undercounts product
 * galleries, extra tweet/Instagram images, favicons and avatars.
 */
export async function storedBytesByUser(): Promise<Map<string, bigint>> {
  const rows = await db.$queryRaw<{ user_id: string; total: bigint | null }[]>`
    SELECT split_part(name, '/', 1) AS user_id,
      SUM(CASE WHEN jsonb_typeof(metadata->'size') = 'number'
        THEN (metadata->>'size')::bigint ELSE 0 END) AS total
    FROM storage.objects
    WHERE bucket_id IN (${Prisma.join([...LIBRARY_BUCKETS])})
    GROUP BY 1
  `;
  // $queryRaw returns SUM as a Decimal, so convert explicitly
  return new Map(
    rows.map((row) => [row.user_id, BigInt(row.total?.toString() ?? "0")]),
  );
}

/**
 * One user's stored files right now: how many objects they have in their
 * library folders (item files and avatars), and their total bytes. Read live
 * from the same source the daily reconcile uses, so the account page's file
 * count and storage used agree with each other rather than lagging a day.
 */
export async function storedFilesForUser(
  userId: string,
): Promise<{ fileCount: number; bytes: bigint }> {
  const [row] = await db.$queryRaw<
    { file_count: bigint; total: bigint | null }[]
  >`
    SELECT COUNT(*) AS file_count,
      SUM(CASE WHEN jsonb_typeof(metadata->'size') = 'number'
        THEN (metadata->>'size')::bigint ELSE 0 END) AS total
    FROM storage.objects
    WHERE bucket_id IN (${Prisma.join([...LIBRARY_BUCKETS])})
      AND name LIKE ${`${userId}/%`}
  `;
  return {
    fileCount: Number(row?.file_count ?? 0),
    bytes: BigInt(row?.total?.toString() ?? "0"),
  };
}
