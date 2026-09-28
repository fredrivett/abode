/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { BookReadingStatus } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedBook } from "@/lib/imports/types";

// enqueueBackgroundProcessing (called per created book) triggers enrich-item via
// the SDK — mock it. Everything else (DB, usage counters) is real.
const trigger = vi.hoisted(() => vi.fn());
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger } }));

import { importBookChunk } from "@/lib/imports/import-book-chunk";

const supabase = {} as SupabaseClient; // covers are null below → never touched

describe("importBookChunk", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    trigger.mockReset().mockResolvedValue({ id: "run_1" });
  });

  const createUser = async () => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `ic-${crypto.randomUUID()}@example.com`,
      },
    });
    return user.id;
  };

  const createImport = async (userId: string, totalCount: number) => {
    const { write } = await import("@/lib/db");
    const imp = await write.itemImport.create({
      data: { userId, source: "literal", status: "importing", totalCount },
      select: { id: true },
    });
    return imp.id;
  };

  const importRow = async (importId: string) => {
    const { read } = await import("@/lib/db");
    return read.itemImport.findUnique({ where: { id: importId } });
  };

  const makeBook = (over: Partial<NormalizedBook> = {}): NormalizedBook => ({
    sourceId: crypto.randomUUID(),
    title: "Test Book",
    subtitle: null,
    description: "d",
    authors: ["A"],
    publisher: null,
    publishedAt: null,
    isbn: crypto.randomUUID(), // unique by default so nothing dedupes
    pageCount: 100,
    language: "en",
    coverUrl: null,
    addedAt: null,
    reading: {
      status: "read",
      rating: 8,
      review: null,
      finishedAt: null,
      finishedAtPrecision: null,
    },
    ...over,
  });

  test("writes a whole-library chunk, completes the import, enqueues enrichment", async () => {
    const userId = await createUser();
    const importId = await createImport(userId, 3);

    const result = await importBookChunk({
      userId,
      importId,
      books: [makeBook(), makeBook(), makeBook()],
      supabase,
    });

    expect(result).toMatchObject({
      imported: 3,
      skipped: 0,
      failed: 0,
      completed: true,
    });
    expect(trigger).toHaveBeenCalledTimes(3); // one enrich-item per created book

    const { read } = await import("@/lib/db");
    expect(await read.item.count({ where: { userId, kind: "book" } })).toBe(3);
    const row = await importRow(importId);
    expect(row?.status).toBe("completed");
    expect(row?.importedCount).toBe(3);
    expect(row?.completedAt).not.toBeNull();
  });

  test("dedupes a repeated ISBN within the chunk (skipped, not enqueued)", async () => {
    const userId = await createUser();
    const importId = await createImport(userId, 2);
    const isbn = "9781234567897";

    const result = await importBookChunk({
      userId,
      importId,
      books: [makeBook({ isbn }), makeBook({ isbn, title: "Dupe" })],
      supabase,
    });

    expect(result).toMatchObject({ imported: 1, skipped: 1, completed: true });
    expect(trigger).toHaveBeenCalledTimes(1); // only the created book enriches
    const row = await importRow(importId);
    expect(row?.importedCount).toBe(1);
    expect(row?.skippedCount).toBe(1);
    expect(row?.status).toBe("completed");
  });

  test("multiple chunks: only the final one completes the import", async () => {
    const userId = await createUser();
    const importId = await createImport(userId, 4);

    const first = await importBookChunk({
      userId,
      importId,
      books: [makeBook(), makeBook()],
      supabase,
    });
    expect(first.completed).toBe(false);
    expect((await importRow(importId))?.status).toBe("importing");

    const second = await importBookChunk({
      userId,
      importId,
      books: [makeBook(), makeBook()],
      supabase,
    });
    expect(second.completed).toBe(true);

    const row = await importRow(importId);
    expect(row?.status).toBe("completed");
    expect(row?.importedCount).toBe(4);
  });

  test("tallies a per-book failure without aborting the chunk or import", async () => {
    const userId = await createUser();
    const importId = await createImport(userId, 3);
    // A deliberately-invalid reading status makes this one book's write throw
    // (Prisma rejects the enum) — exercising the catch/tally path.
    const bad = makeBook({
      reading: {
        status: "not_a_status" as BookReadingStatus,
        rating: null,
        review: null,
        finishedAt: null,
        finishedAtPrecision: null,
      },
    });

    const result = await importBookChunk({
      userId,
      importId,
      books: [makeBook(), bad, makeBook()],
      supabase,
    });

    expect(result).toMatchObject({ imported: 2, failed: 1, completed: true });
    expect(trigger).toHaveBeenCalledTimes(2); // only the 2 good books enqueue

    const { read } = await import("@/lib/db");
    // The bad book's transaction rolled back — only the good ones persisted.
    expect(await read.item.count({ where: { userId, kind: "book" } })).toBe(2);
    const row = await importRow(importId);
    expect(row?.importedCount).toBe(2);
    expect(row?.failedCount).toBe(1);
    expect(row?.status).toBe("completed"); // failures still count toward total
  });
});
