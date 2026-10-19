import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/url", () => ({ getAppBaseUrl: () => "https://abode.test" }));

import {
  type BookReview,
  bookReviewByline,
  bookReviewCardLayout,
  bookReviewDescription,
  bookReviewSharePath,
  bookReviewShareUrl,
  formatBookReview,
  ratingLabel,
  ratingStarsText,
  readingDatesLabel,
  reviewText,
  toBookReview,
} from "./review";

const empty: BookReview = {
  status: null,
  rating: null,
  review: null,
  startedAt: null,
  startedAtPrecision: null,
  finishedAt: null,
  finishedAtPrecision: null,
};

const read: BookReview = {
  status: "read",
  rating: 7,
  review: "Gripping.\n\nAnd maddening.",
  startedAt: "2023-11-01T00:00:00.000Z",
  startedAtPrecision: "month",
  finishedAt: "2026-10-19T21:22:13.512Z",
  finishedAtPrecision: "day",
};

describe("share links", () => {
  it("points at the item's review page", () => {
    const target = { username: "fred", itemId: "item-1" };
    expect(bookReviewSharePath(target)).toBe("/@fred/items/item-1/review");
    expect(bookReviewShareUrl(target)).toBe(
      "https://abode.test/@fred/items/item-1/review",
    );
  });
});

describe("toBookReview", () => {
  it("keeps only the review fields of a book", () => {
    const book = { ...read, progressValue: 120, isbn: "123" };
    expect(toBookReview(book)).toEqual(read);
  });
});

describe("reviewText", () => {
  it("treats a blank review as none", () => {
    expect(reviewText({ ...empty, review: "  \n " })).toBeNull();
    expect(reviewText({ ...empty, review: " Good " })).toBe("Good");
  });
});

describe("readingDatesLabel", () => {
  it("joins started and finished into a range", () => {
    expect(readingDatesLabel(read)).toBe("Nov 2023 – Oct 19, 2026");
  });

  it("labels a lone date", () => {
    expect(readingDatesLabel({ ...read, finishedAt: null })).toBe(
      "Started Nov 2023",
    );
    expect(readingDatesLabel({ ...read, startedAt: null })).toBe(
      "Finished Oct 19, 2026",
    );
  });

  it("collapses a range that starts and ends on the same label", () => {
    expect(
      readingDatesLabel({
        ...empty,
        startedAt: "2024-01-01T00:00:00.000Z",
        startedAtPrecision: "year",
        finishedAt: "2024-01-01T00:00:00.000Z",
        finishedAtPrecision: "year",
      }),
    ).toBe("2024");
  });

  it("is null without dates", () => {
    expect(readingDatesLabel(empty)).toBeNull();
  });
});

describe("bookReviewByline", () => {
  it("lists the reader, status and dates", () => {
    expect(bookReviewByline({ username: "fred", review: read })).toBe(
      "@fred · Read · Nov 2023 – Oct 19, 2026",
    );
  });

  it("is just the reader when there's nothing else", () => {
    expect(bookReviewByline({ username: "fred", review: empty })).toBe("@fred");
  });
});

describe("ratings", () => {
  it("renders /10 ratings as stars out of five", () => {
    expect(ratingStarsText(10)).toBe("★★★★★");
    expect(ratingStarsText(7)).toBe("★★★½");
    expect(ratingStarsText(1)).toBe("½");
  });

  it("reads a rating aloud out of five", () => {
    expect(ratingLabel(7)).toBe("3.5 out of 5");
  });
});

describe("bookReviewCardLayout", () => {
  it("sets a short review large and in full", () => {
    const layout = bookReviewCardLayout({ title: "Dune", review: "Superb." });
    expect(layout.title).toEqual({ text: "Dune", fontSize: 60 });
    expect(layout.review).toEqual({ text: "Superb.", fontSize: 34 });
  });

  it("flattens a review's paragraphs into one excerpt", () => {
    const layout = bookReviewCardLayout({
      title: "Dune",
      review: "One.\n\nTwo.",
    });
    expect(layout.review?.text).toBe("One. Two.");
  });

  it("truncates a long review, leaving less room under a wrapping title", () => {
    const review = "word ".repeat(200);
    const short = bookReviewCardLayout({ title: "Dune", review });
    const wrapping = bookReviewCardLayout({
      title: "The Surprisingly Long Title of a Book",
      review,
    });
    expect(short.review?.fontSize).toBe(27);
    expect(short.review?.text.endsWith("…")).toBe(true);
    expect(short.review?.text.length).toBeLessThanOrEqual(300);
    expect(wrapping.review?.text.length).toBeLessThanOrEqual(220);
    expect(wrapping.review?.text.length).toBeLessThan(
      short.review?.text.length ?? 0,
    );
  });

  it("steps a longer title down, and truncates a very long one", () => {
    expect(
      bookReviewCardLayout({ title: "Moby-Dick; or, The Whale", review: "x" })
        .title.fontSize,
    ).toBe(48);
    const long = bookReviewCardLayout({
      title:
        "Thinking in Systems: A Primer on the Big Picture and Why Everything Is Connected",
      review: "x",
    }).title;
    expect(long.fontSize).toBe(40);
    expect(long.text).toBe(
      "Thinking in Systems: A Primer on the Big Picture and Why…",
    );
  });

  it("enlarges the title when there's no review", () => {
    const layout = bookReviewCardLayout({ title: "Dune", review: null });
    expect(layout.review).toBeNull();
    expect(layout.title.fontSize).toBe(75);
  });
});

describe("formatBookReview", () => {
  it("puts the rating and book above the review and link", () => {
    expect(
      formatBookReview({
        title: "Elon Musk",
        authors: ["Walter Isaacson"],
        review: read,
        url: "https://abode.test/r",
      }),
    ).toBe(
      "★★★½ Elon Musk by Walter Isaacson\n\nGripping.\n\nAnd maddening.\n\nhttps://abode.test/r",
    );
  });

  it("closes up around a missing rating, author and review", () => {
    expect(
      formatBookReview({ title: "Dune", authors: [], review: empty }),
    ).toBe("Dune");
  });
});

describe("bookReviewDescription", () => {
  const base = { username: "fred", title: "Dune" };

  it("excerpts the review", () => {
    expect(bookReviewDescription({ ...base, review: read })).toBe(
      "Gripping. And maddening.",
    );
  });

  it("falls back to the rating, then the shelf", () => {
    expect(
      bookReviewDescription({ ...base, review: { ...empty, rating: 8 } }),
    ).toBe("@fred rated Dune 4 out of 5");
    expect(bookReviewDescription({ ...base, review: empty })).toBe(
      "Dune, on @fred's bookshelf",
    );
  });
});
