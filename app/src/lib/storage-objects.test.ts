import { describe, expect, it, vi } from "vitest";
import {
  listAllObjectPaths,
  removeAllObjectsUnderPrefix,
  removeUserStorage,
  STORAGE_PAGE_SIZE,
} from "./storage-objects";

type ListOptions = { limit?: number; offset?: number };
type Result<T> = { data: T | null; error: Error | null };
type Bucket = Parameters<typeof listAllObjectPaths>[0];
type Client = Parameters<typeof removeUserStorage>[0];

/**
 * In-memory stand-in for a Supabase Storage bucket that mimics `list()`: one
 * level at a time, sub-folders as `id: null` entries, and only 100 entries
 * when no limit is passed.
 */
function fakeBucket(initialPaths: string[]) {
  const objects = new Set(initialPaths);

  const list = vi.fn(
    async (
      prefix: string,
      options: ListOptions = {},
    ): Promise<Result<{ name: string; id: string | null }[]>> => {
      const children = new Map<string, string | null>();
      for (const path of objects) {
        if (!path.startsWith(`${prefix}/`)) continue;
        const [name, ...rest] = path.slice(prefix.length + 1).split("/");
        children.set(name, rest.length > 0 ? null : path);
      }
      const entries = [...children.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, id]) => ({ name, id }));
      const offset = options.offset ?? 0;
      const limit = options.limit ?? 100;
      return { data: entries.slice(offset, offset + limit), error: null };
    },
  );

  const remove = vi.fn(
    async (paths: string[]): Promise<Result<{ name: string }[]>> => {
      for (const path of paths) objects.delete(path);
      return { data: paths.map((name) => ({ name })), error: null };
    },
  );

  const bucket = { list, remove } as unknown as Bucket;
  return { objects, bucket, list, remove };
}

const paths = (prefix: string, count: number) =>
  Array.from(
    { length: count },
    (_, i) => `${prefix}/${String(i).padStart(5, "0")}.jpg`,
  );

describe("listAllObjectPaths", () => {
  it("pages past list()'s default 100 entries", async () => {
    const all = paths("user-1", STORAGE_PAGE_SIZE + 250);
    const { bucket, list } = fakeBucket(all);

    const listed = await listAllObjectPaths(bucket, "user-1");

    expect(listed).toHaveLength(all.length);
    expect(new Set(listed)).toEqual(new Set(all));
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("descends into sub-folders", async () => {
    const { bucket } = fakeBucket([
      "user-1/a.jpg",
      "user-1/nested/b.jpg",
      "user-1/nested/deeper/c.jpg",
    ]);

    expect(new Set(await listAllObjectPaths(bucket, "user-1"))).toEqual(
      new Set([
        "user-1/a.jpg",
        "user-1/nested/b.jpg",
        "user-1/nested/deeper/c.jpg",
      ]),
    );
  });

  it("only lists under the given prefix", async () => {
    const { bucket } = fakeBucket(["user-1/a.jpg", "user-2/b.jpg"]);
    expect(await listAllObjectPaths(bucket, "user-1")).toEqual([
      "user-1/a.jpg",
    ]);
  });

  it("throws on a list error rather than returning a partial listing", async () => {
    const { bucket, list } = fakeBucket(["user-1/a.jpg"]);
    list.mockResolvedValueOnce({ data: null, error: new Error("boom") });

    await expect(listAllObjectPaths(bucket, "user-1")).rejects.toThrow("boom");
  });
});

describe("removeAllObjectsUnderPrefix", () => {
  it("removes every object in chunks, leaving other prefixes alone", async () => {
    const own = paths("user-1", STORAGE_PAGE_SIZE * 2 + 5);
    const { bucket, objects, remove } = fakeBucket([...own, "user-2/keep.jpg"]);

    const removed = await removeAllObjectsUnderPrefix(bucket, "user-1");

    expect(removed).toBe(own.length);
    expect([...objects]).toEqual(["user-2/keep.jpg"]);
    expect(remove).toHaveBeenCalledTimes(3);
    for (const [chunk] of remove.mock.calls) {
      expect(chunk.length).toBeLessThanOrEqual(STORAGE_PAGE_SIZE);
    }
  });

  it("throws when a chunk fails to remove", async () => {
    const { bucket, remove } = fakeBucket(["user-1/a.jpg"]);
    remove.mockResolvedValueOnce({ data: null, error: new Error("denied") });

    await expect(removeAllObjectsUnderPrefix(bucket, "user-1")).rejects.toThrow(
      "denied",
    );
  });
});

describe("removeUserStorage", () => {
  it("empties the user's folder in every bucket", async () => {
    const items = fakeBucket(paths("user-1", 150));
    const avatars = fakeBucket(["user-1/avatar.png", "user-2/avatar.png"]);
    const supabase = {
      storage: {
        from: (name: string) =>
          name === "items" ? items.bucket : avatars.bucket,
      },
    };

    const result = await removeUserStorage(supabase as Client, "user-1");

    expect(result).toEqual({ removed: 151, failures: [] });
    expect(items.objects.size).toBe(0);
    expect([...avatars.objects]).toEqual(["user-2/avatar.png"]);
  });

  it("still clears the other buckets when one fails, and reports it", async () => {
    const items = fakeBucket(["user-1/a.jpg"]);
    const avatars = fakeBucket(["user-1/avatar.png"]);
    items.list.mockResolvedValueOnce({ data: null, error: new Error("down") });
    const supabase = {
      storage: {
        from: (name: string) =>
          name === "items" ? items.bucket : avatars.bucket,
      },
    };

    const result = await removeUserStorage(supabase as Client, "user-1");

    expect(result.removed).toBe(1);
    expect(result.failures).toEqual([
      { bucket: "items", error: expect.any(Error) },
    ]);
    expect(avatars.objects.size).toBe(0);
  });
});
