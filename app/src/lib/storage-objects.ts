import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Page size for listing and chunk size for removing storage objects. Supabase's
 * `list()` silently returns only 100 entries unless given a limit, so an
 * unpaged list under-reports any folder past that — which once left every file
 * beyond the first 100 behind when an account was deleted.
 */
export const STORAGE_PAGE_SIZE = 1000;

/** Buckets whose objects live under a `{userId}/` folder */
export const USER_STORAGE_BUCKETS = ["items", "avatars"] as const;

type StorageBucket = ReturnType<SupabaseClient["storage"]["from"]>;
type BucketApi = Pick<StorageBucket, "list" | "remove">;

/**
 * Every object path under `prefix`, paging past `list()`'s default 100 and
 * descending into sub-folders (entries with a null `id`). Throws on a list
 * error rather than returning a silently partial listing.
 */
export async function listAllObjectPaths(
  bucket: BucketApi,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
    const { data, error } = await bucket.list(prefix, {
      limit: STORAGE_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;

    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null) {
        paths.push(...(await listAllObjectPaths(bucket, path)));
      } else {
        paths.push(path);
      }
    }
    if (!data || data.length < STORAGE_PAGE_SIZE) return paths;
  }
}

/**
 * Removes every object under `prefix`, in chunks. Throws if listing or any
 * chunk's removal fails, so callers can report the leak instead of assuming
 * the folder is empty. Returns how many objects were removed.
 */
export async function removeAllObjectsUnderPrefix(
  bucket: BucketApi,
  prefix: string,
): Promise<number> {
  const paths = await listAllObjectPaths(bucket, prefix);
  for (let i = 0; i < paths.length; i += STORAGE_PAGE_SIZE) {
    const { error } = await bucket.remove(
      paths.slice(i, i + STORAGE_PAGE_SIZE),
    );
    if (error) throw error;
  }
  return paths.length;
}

/**
 * Removes every stored file a user owns (item files and avatars). Each bucket
 * is attempted even if another fails; failures are returned, not thrown, as
 * this runs after the user's rows are already gone.
 */
export async function removeUserStorage(
  supabaseAdmin: Pick<SupabaseClient, "storage">,
  userId: string,
): Promise<{
  removed: number;
  failures: { bucket: string; error: unknown }[];
}> {
  let removed = 0;
  const failures: { bucket: string; error: unknown }[] = [];
  for (const bucket of USER_STORAGE_BUCKETS) {
    try {
      removed += await removeAllObjectsUnderPrefix(
        supabaseAdmin.storage.from(bucket),
        userId,
      );
    } catch (error) {
      failures.push({ bucket, error });
    }
  }
  return { removed, failures };
}
