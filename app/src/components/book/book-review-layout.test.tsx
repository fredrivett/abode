import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./book-cover-3d", () => ({
  BookCover3D: ({
    alt,
    src,
    fallback,
    coverColor,
  }: {
    alt: string;
    src: string | null;
    fallback: ReactNode;
    coverColor?: string;
  }) => (
    <div
      role="img"
      aria-label={alt}
      data-src={src ?? ""}
      data-color={coverColor ?? ""}
    >
      {!src && fallback}
    </div>
  ),
}));

import {
  BookReviewLayout,
  type BookReviewLayoutBook,
  bookFactsLine,
} from "./book-review-layout";

const book: BookReviewLayoutBook = {
  id: "item-1",
  title: "Elon Musk",
  authors: ["Walter Isaacson"],
  publisher: "Simon & Schuster",
  publishedAt: "2023-09-12T00:00:00.000Z",
  pageCount: 688,
  coverUrl: "/api/v1/images/elon.jpg",
  coverColor: "#1c1d22",
  sourceUrl: "https://example.com/elon",
  domain: "example.com",
};

describe("bookFactsLine", () => {
  it("lists publisher, year and pages", () => {
    expect(bookFactsLine(book)).toBe("Simon & Schuster · 2023 · 688 pages");
  });

  it("skips what's missing, and is null with nothing", () => {
    expect(bookFactsLine({ ...book, publisher: null, pageCount: null })).toBe(
      "2023",
    );
    expect(
      bookFactsLine({ publisher: null, publishedAt: null, pageCount: null }),
    ).toBeNull();
  });
});

describe("BookReviewLayout", () => {
  it("shows the book with its cover, link and the review", () => {
    render(
      <BookReviewLayout book={book}>
        <p>The review</p>
      </BookReviewLayout>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Elon Musk" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Walter Isaacson")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Cover of Elon Musk" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View on example.com/ }),
    ).toHaveAttribute("href", "https://example.com/elon");
    expect(screen.getByText("The review")).toBeInTheDocument();
  });

  it("typesets a cover for a book without one", () => {
    render(
      <BookReviewLayout
        book={{ ...book, coverUrl: null, sourceUrl: null, authors: [] }}
      >
        {null}
      </BookReviewLayout>,
    );
    expect(
      screen.getByRole("img", { name: "Cover of Elon Musk" }),
    ).toHaveAttribute("data-src", "");
    // Once as the heading, once on the typeset board
    expect(screen.getAllByText("Elon Musk")).toHaveLength(2);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("gives a coverless book with no colour a dark board for its white type", () => {
    render(
      <BookReviewLayout book={{ ...book, coverUrl: null, coverColor: null }}>
        {null}
      </BookReviewLayout>,
    );
    expect(
      screen.getByRole("img", { name: "Cover of Elon Musk" }),
    ).toHaveAttribute("data-color", "#2a2a2a");
  });
});
