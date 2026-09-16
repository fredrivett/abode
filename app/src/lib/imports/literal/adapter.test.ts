import { describe, expect, it } from "vitest";
import {
  mapRating,
  mapReadingStatus,
  parseLiteralPublishedDate,
  toNormalizedBook,
} from "@/lib/imports/literal/adapter";
import type {
  LiteralBook,
  LiteralReadingState,
  LiteralReadingStatus,
  LiteralReview,
} from "@/lib/imports/literal/client";

const book = (over: Partial<LiteralBook> = {}): LiteralBook => ({
  id: "bk1",
  slug: "why-greatness",
  title: "Why Greatness Cannot Be Planned",
  subtitle: "The Myth of the Objective",
  description: "desc",
  cover: "https://assets.literal.club/1/bk1.jpg",
  language: "en",
  authors: [{ name: "Kenneth O. Stanley" }, { name: "Joel Lehman" }],
  isbn13: "9783319155241",
  isbn10: "3319155245",
  pageCount: 141,
  publishedDate: null,
  publisher: null,
  ...over,
});

const state = (
  over: {
    status?: LiteralReadingStatus;
    createdAt?: string;
    book?: LiteralBook;
  } = {},
): LiteralReadingState & { book: LiteralBook } => ({
  id: "rs1",
  status: over.status ?? "FINISHED",
  createdAt: over.createdAt ?? "2025-02-02T09:00:30.888Z",
  book: over.book ?? book(),
});

describe("mapReadingStatus", () => {
  it("maps every Literal shelf to the abode status (NONE → null)", () => {
    expect(mapReadingStatus("WANTS_TO_READ")).toBe("want_to_read");
    expect(mapReadingStatus("IS_READING")).toBe("reading");
    expect(mapReadingStatus("FINISHED")).toBe("read");
    expect(mapReadingStatus("DROPPED")).toBe("dnf");
    expect(mapReadingStatus("NONE")).toBeNull();
  });
});

describe("mapRating", () => {
  it("doubles the 0–5 half-star rating into the /10 scale", () => {
    expect(mapRating(5)).toBe(10);
    expect(mapRating(4)).toBe(8);
    expect(mapRating(3.5)).toBe(7);
    expect(mapRating(0.5)).toBe(1);
  });

  it("treats no rating / a 0-star rating as unrated (null)", () => {
    expect(mapRating(null)).toBeNull();
    expect(mapRating(undefined)).toBeNull();
    expect(mapRating(0)).toBeNull();
    expect(mapRating(Number.NaN)).toBeNull();
  });

  it("clamps above the max", () => {
    expect(mapRating(6)).toBe(10);
  });
});

describe("parseLiteralPublishedDate", () => {
  it("parses a bare year to Jan 1 UTC", () => {
    expect(parseLiteralPublishedDate("2015")?.toISOString()).toBe(
      "2015-01-01T00:00:00.000Z",
    );
  });
  it("parses an ISO date and rejects junk / null", () => {
    expect(parseLiteralPublishedDate("2015-03-10")?.getUTCFullYear()).toBe(
      2015,
    );
    expect(parseLiteralPublishedDate(null)).toBeNull();
    expect(parseLiteralPublishedDate("not a date")).toBeNull();
  });
});

describe("toNormalizedBook", () => {
  it("maps a finished, reviewed book fully", () => {
    const review: LiteralReview = {
      rating: 4,
      text: "  Great read  ",
      createdAt: "2025-02-02T09:00:30.888Z",
    };
    const nb = toNormalizedBook(state(), review);

    expect(nb).toMatchObject({
      sourceId: "bk1",
      title: "Why Greatness Cannot Be Planned",
      authors: ["Kenneth O. Stanley", "Joel Lehman"],
      isbn: "9783319155241", // isbn13 preferred
      pageCount: 141,
      language: "en",
      coverUrl: "https://assets.literal.club/1/bk1.jpg",
    });
    expect(nb.reading.status).toBe("read");
    expect(nb.reading.rating).toBe(8);
    expect(nb.reading.review).toBe("Great read"); // trimmed
    expect(nb.reading.finishedAt?.toISOString()).toBe(
      "2025-02-02T09:00:30.888Z",
    );
    expect(nb.reading.finishedAtPrecision).toBe("day");
  });

  it("falls back to isbn10 and nulls a zero pageCount", () => {
    const nb = toNormalizedBook(
      state({ book: book({ isbn13: null, pageCount: 0 }) }),
      null,
    );
    expect(nb.isbn).toBe("3319155245");
    expect(nb.pageCount).toBeNull();
  });

  it("want-to-read with no review → no rating, no finishedAt", () => {
    const nb = toNormalizedBook(state({ status: "WANTS_TO_READ" }), null);
    expect(nb.reading.status).toBe("want_to_read");
    expect(nb.reading.rating).toBeNull();
    expect(nb.reading.review).toBeNull();
    expect(nb.reading.finishedAt).toBeNull();
    expect(nb.reading.finishedAtPrecision).toBeNull();
  });

  it("finished with no review → finishedAt proxied from the shelf createdAt", () => {
    const nb = toNormalizedBook(
      state({ status: "FINISHED", createdAt: "2024-08-25T17:27:39.707Z" }),
      null,
    );
    expect(nb.reading.status).toBe("read");
    expect(nb.reading.finishedAt?.toISOString()).toBe(
      "2024-08-25T17:27:39.707Z",
    );
  });

  it("does not set finishedAt on a non-terminal shelf, even with a review", () => {
    // Reviewing mid-read must not mark a book finished.
    const review: LiteralReview = {
      rating: 4,
      text: "so far so good",
      createdAt: "2025-02-02T09:00:30.888Z",
    };
    const nb = toNormalizedBook(state({ status: "IS_READING" }), review);
    expect(nb.reading.status).toBe("reading");
    expect(nb.reading.rating).toBe(8); // rating still carries
    expect(nb.reading.finishedAt).toBeNull();
    expect(nb.reading.finishedAtPrecision).toBeNull();
  });

  it("sets finishedAt for a DROPPED (dnf) shelf", () => {
    const nb = toNormalizedBook(
      state({ status: "DROPPED", createdAt: "2024-08-25T17:27:39.707Z" }),
      null,
    );
    expect(nb.reading.status).toBe("dnf");
    expect(nb.reading.finishedAt?.toISOString()).toBe(
      "2024-08-25T17:27:39.707Z",
    );
  });

  it("NONE shelf → null status but still a valid book", () => {
    const nb = toNormalizedBook(state({ status: "NONE" }), null);
    expect(nb.reading.status).toBeNull();
    expect(nb.title).toBe("Why Greatness Cannot Be Planned");
  });
});
