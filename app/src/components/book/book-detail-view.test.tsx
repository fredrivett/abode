import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BookDetails } from "@/lib/types/item";
import { BookDetailView } from "./book-detail-view";

const baseBook: BookDetails = {
  authors: ["Robin Sloan"],
  publisher: null,
  publishedAt: null,
  isbn: null,
  pageCount: null,
  domain: "example.com",
  status: null,
  startedAt: null,
  startedAtPrecision: null,
  finishedAt: null,
  finishedAtPrecision: null,
  progressValue: null,
  progressUnit: "page",
  progressUpdatedAt: null,
  rating: null,
  review: null,
};

describe("BookDetailView", () => {
  it("renders the View on link for a valid http(s) sourceUrl", () => {
    render(
      <BookDetailView
        itemId="item-1"
        bookDetails={baseBook}
        sourceUrl="https://example.com/book/1"
      />,
    );
    const link = screen.getByRole("link", { name: /view on/i });
    expect(link).toHaveAttribute("href", "https://example.com/book/1");
  });

  it("omits the View on link for a non-http(s) sourceUrl", () => {
    render(
      <BookDetailView
        itemId="item-1"
        bookDetails={baseBook}
        sourceUrl="javascript:alert(1)"
      />,
    );
    expect(
      screen.queryByRole("link", { name: /view on/i }),
    ).not.toBeInTheDocument();
  });
});
