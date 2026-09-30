/// <reference types="vitest/globals" />

import { storedBytesByUser, storedFilesForUser } from "@/lib/storage-usage";

/**
 * The test database is plain Postgres, not Supabase, so stand in the one table
 * the query reads: storage.objects (bucket, path, and metadata.size).
 */
async function createStorageObjectsTable() {
  const { write } = await import("@/lib/db");
  await write.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS storage`);
  await write.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS storage.objects (bucket_id text, name text, metadata jsonb)`,
  );
  await write.$executeRawUnsafe(`TRUNCATE storage.objects`);
}

async function putObject(bucket: string, name: string, metadata: unknown) {
  const { write } = await import("@/lib/db");
  await write.$executeRaw`
    INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES (${bucket}, ${name}, ${JSON.stringify(metadata)}::jsonb)
  `;
}

describe("storedBytesByUser", () => {
  beforeEach(createStorageObjectsTable);

  afterAll(async () => {
    const { write } = await import("@/lib/db");
    await write.$executeRawUnsafe(`DROP SCHEMA IF EXISTS storage CASCADE`);
  });

  it("sums every object in the user's item and avatar folders", async () => {
    // Upload, a product gallery image and a favicon — the last two are what
    // per-item meta sizes miss — plus an avatar
    await putObject("items", "user-a/upload.jpg", { size: 1000 });
    await putObject("items", "user-a/gallery-2.jpg", { size: 200 });
    await putObject("items", "user-a/favicon.png", { size: 30 });
    await putObject("avatars", "user-a/avatar.png", { size: 4 });
    await putObject("items", "user-b/upload.jpg", { size: 7 });

    const bytes = await storedBytesByUser();

    expect(bytes.get("user-a")).toBe(BigInt(1234));
    expect(bytes.get("user-b")).toBe(BigInt(7));
  });

  it("ignores other buckets and objects without a numeric size", async () => {
    await putObject("items", "user-a/upload.jpg", { size: 10 });
    await putObject("exports", "user-a/archive.zip", { size: 999_999 });
    await putObject("items", "user-a/pending.jpg", {});
    await putObject("items", "user-a/odd.jpg", { size: "12" });

    expect((await storedBytesByUser()).get("user-a")).toBe(BigInt(10));
  });

  it("omits users with nothing stored", async () => {
    expect((await storedBytesByUser()).size).toBe(0);
  });
});

describe("storedFilesForUser", () => {
  beforeEach(createStorageObjectsTable);

  afterAll(async () => {
    const { write } = await import("@/lib/db");
    await write.$executeRawUnsafe(`DROP SCHEMA IF EXISTS storage CASCADE`);
  });

  it("counts one user's library files and bytes, ignoring others and export archives", async () => {
    await putObject("items", "user-a/upload.jpg", { size: 1000 });
    await putObject("items", "user-a/cover.jpg", { size: 200 });
    await putObject("avatars", "user-a/avatar.png", { size: 4 });
    await putObject("exports", "user-a/export-1/part-1.zip", { size: 999_999 });
    await putObject("items", "user-ab/other.jpg", { size: 50 });
    await putObject("items", "user-b/upload.jpg", { size: 7 });

    expect(await storedFilesForUser("user-a")).toEqual({
      fileCount: 3,
      bytes: BigInt(1204),
    });
  });

  it("reports nothing for a user with no files", async () => {
    expect(await storedFilesForUser("nobody")).toEqual({
      fileCount: 0,
      bytes: BigInt(0),
    });
  });
});
