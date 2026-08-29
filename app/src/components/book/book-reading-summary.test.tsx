import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BookDetails } from "@/lib/types/item";
import { BookReadingSummary } from "./book-reading-summary";

const baseBook: BookDetails = {
  authors: ["Author"],
  publisher: null,
  publishedAt: null,
  isbn: null,
  pageCount: null,
  domain: null,
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

describe("BookReadingSummary", () => {
  it("renders nothing when there is no reading data", () => {
    const { container } = render(<BookReadingSummary bookDetails={baseBook} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the status label", () => {
    render(
      <BookReadingSummary bookDetails={{ ...baseBook, status: "read" }} />,
    );
    expect(screen.getByText("Read")).toBeInTheDocument();
  });

  it("shows the rating as a read-only star display", () => {
    render(<BookReadingSummary bookDetails={{ ...baseBook, rating: 9 }} />);
    // 9/10 => 4.5 out of 5
    expect(screen.getByLabelText("Rated 4.5 out of 5")).toBeInTheDocument();
  });

  it("shows the review text", () => {
    render(
      <BookReadingSummary bookDetails={{ ...baseBook, review: "Loved it" }} />,
    );
    expect(screen.getByText("Loved it")).toBeInTheDocument();
  });

  it("renders a started–finished range when both dates are set", () => {
    render(
      <BookReadingSummary
        bookDetails={{
          ...baseBook,
          startedAt: "2026-07-01T00:00:00.000Z",
          startedAtPrecision: "day",
          finishedAt: "2026-08-01T00:00:00.000Z",
          finishedAtPrecision: "day",
        }}
      />,
    );
    expect(
      screen.getByText(/Jul 1, 2026\s+–\s+Aug 1, 2026/),
    ).toBeInTheDocument();
  });

  it("labels a lone finished date", () => {
    render(
      <BookReadingSummary
        bookDetails={{
          ...baseBook,
          finishedAt: "2026-08-01T00:00:00.000Z",
          finishedAtPrecision: "year",
        }}
      />,
    );
    expect(screen.getByText("Finished 2026")).toBeInTheDocument();
  });
});
