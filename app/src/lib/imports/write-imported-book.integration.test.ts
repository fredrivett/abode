/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedBook } from "@/lib/imports/types";
import { writeImportedBook } from "@/lib/imports/write-imported-book";

// coverUrl is null in every fixture below, so the cover path (the only thing
// that touches Supabase) is never exercised — a bare stub is enough.
const supabase = {} as SupabaseClient;

describe("writeImportedBook", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createUser = async () => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `imp-${crypto.randomUUID()}@example.com`,
      },
    });
    return user.id;
  };

  const makeBook = (over: Partial<NormalizedBook> = {}): NormalizedBook => ({
    sourceId: "bk1",
    title: "Test Book",
    subtitle: null,
    description: "a description",
    authors: ["Ann Author"],
    publisher: "Pub",
    publishedAt: null,
    isbn: "9781234567897",
    pageCount: 200,
    language: "en",
    coverUrl: null,
    addedAt: new Date("2021-06-15T12:00:00.000Z"),
    reading: {
      status: "read",
      rating: 8,
      review: "good",
      finishedAt: new Date("2025-02-02T09:00:30.000Z"),
      finishedAtPrecision: "day",
      ...over.reading,
    },
    ...over,
  });

  const write_ = (userId: string, book: NormalizedBook) =>
    writeImportedBook({ userId, book, source: "literal", supabase });

  const itemWithDetails = async (itemId: string) => {
    const { read } = await import("@/lib/db");
    return read.item.findUnique({
      where: { id: itemId },
      include: { bookDetails: true },
    });
  };

  test("creates a book item + details with reading state and counts it", async () => {
    const userId = await createUser();
    const res = await write_(userId, makeBook());
    expect(res.status).toBe("created");
    if (res.status !== "created") return;

    const item = await itemWithDetails(res.itemId);
    expect(item?.kind).toBe("book");
    expect(item?.title).toBe("Test Book");
    expect(item?.processingStatus).toBe("pending");
    expect(item?.meta).toMatchObject({
      importSource: "literal",
      importSourceId: "bk1",
    });
    expect(item?.bookDetails).toMatchObject({
      authors: ["Ann Author"],
      isbn: "9781234567897",
      pageCount: 200,
      status: "read",
      rating: 8,
      review: "good",
      finishedAtPrecision: "day",
    });
    // Day precision passes the instant through unchanged.
    expect(item?.bookDetails?.finishedAt?.toISOString()).toBe(
      "2025-02-02T09:00:30.000Z",
    );
    // createdAt is back-dated to the source's added date (drives the timeline).
    expect(item?.createdAt?.toISOString()).toBe("2021-06-15T12:00:00.000Z");

    const { read } = await import("@/lib/db");
    const user = await read.user.findUnique({
      where: { id: userId },
      select: { itemCount: true },
    });
    expect(user?.itemCount).toBe(1);
  });

  test("skips a duplicate ISBN for the same user", async () => {
    const userId = await createUser();
    expect((await write_(userId, makeBook())).status).toBe("created");
    expect((await write_(userId, makeBook())).status).toBe("skipped");

    const { read } = await import("@/lib/db");
    expect(await read.item.count({ where: { userId } })).toBe(1);
  });

  test("always imports books without an ISBN (no dedupe key)", async () => {
    const userId = await createUser();
    await write_(userId, makeBook({ isbn: null }));
    await write_(userId, makeBook({ isbn: null, title: "Another" }));

    const { read } = await import("@/lib/db");
    expect(await read.item.count({ where: { userId } })).toBe(2);
  });

  test("different users can each import the same ISBN", async () => {
    const u1 = await createUser();
    const u2 = await createUser();
    expect((await write_(u1, makeBook())).status).toBe("created");
    expect((await write_(u2, makeBook())).status).toBe("created");
  });

  test("carries a null reading status through (Literal NONE shelf)", async () => {
    const userId = await createUser();
    const res = await write_(
      userId,
      makeBook({
        isbn: null,
        reading: {
          status: null,
          rating: null,
          review: null,
          finishedAt: null,
          finishedAtPrecision: null,
        },
      }),
    );
    expect(res.status).toBe("created");
    if (res.status !== "created") return;
    const item = await itemWithDetails(res.itemId);
    expect(item?.bookDetails?.status).toBeNull();
    expect(item?.bookDetails?.rating).toBeNull();
    expect(item?.bookDetails?.finishedAt).toBeNull();
  });
});
