import { describe, expect, it } from "vitest";
import { hydrateBook, serializeBook } from "@/lib/imports/payload";
import type { NormalizedBook } from "@/lib/imports/types";

const book: NormalizedBook = {
  sourceId: "bk1",
  title: "T",
  subtitle: null,
  description: null,
  authors: ["A"],
  publisher: null,
  publishedAt: new Date("2015-03-10T00:00:00.000Z"),
  isbn: "9781234567897",
  pageCount: 200,
  language: "en",
  coverUrl: "https://x/y.jpg",
  addedAt: new Date("2021-06-15T12:00:00.000Z"),
  reading: {
    status: "read",
    rating: 8,
    review: "r",
    finishedAt: new Date("2025-02-02T09:00:30.000Z"),
    finishedAtPrecision: "day",
  },
};

describe("serializeBook / hydrateBook", () => {
  it("round-trips a book unchanged through the JSON boundary", () => {
    const round = hydrateBook(serializeBook(book));
    expect(round).toEqual(book);
    expect(round.publishedAt).toBeInstanceOf(Date);
    expect(round.reading.finishedAt).toBeInstanceOf(Date);
  });

  it("serializes dates to ISO strings", () => {
    const s = serializeBook(book);
    expect(s.publishedAt).toBe("2015-03-10T00:00:00.000Z");
    expect(s.addedAt).toBe("2021-06-15T12:00:00.000Z");
    expect(s.reading.finishedAt).toBe("2025-02-02T09:00:30.000Z");
  });

  it("preserves null dates in both directions", () => {
    const s = serializeBook({
      ...book,
      publishedAt: null,
      reading: { ...book.reading, finishedAt: null },
    });
    expect(s.publishedAt).toBeNull();
    expect(s.reading.finishedAt).toBeNull();
    const round = hydrateBook(s);
    expect(round.publishedAt).toBeNull();
    expect(round.reading.finishedAt).toBeNull();
  });
});
