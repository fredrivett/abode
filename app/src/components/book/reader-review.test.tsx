import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BookReview } from "@/lib/books/review";
import { type BookReader, ReaderReview } from "./reader-review";

const reader: BookReader = {
  username: "fred",
  firstName: "Fred",
  lastName: "Rivett",
  avatarUrl: null,
};

const empty: BookReview = {
  status: null,
  rating: null,
  review: null,
  startedAt: null,
  startedAtPrecision: null,
  finishedAt: null,
  finishedAtPrecision: null,
};

const full: BookReview = {
  status: "read",
  rating: 7,
  review: "Fascinating.\n\nAnd a little terrifying.",
  startedAt: "2023-11-01T00:00:00.000Z",
  startedAtPrecision: "month",
  finishedAt: "2026-10-19T21:22:13.512Z",
  finishedAtPrecision: "day",
};

describe("ReaderReview", () => {
  it("credits the reader, linking to their profile", () => {
    render(<ReaderReview reader={reader} review={full} />);
    expect(screen.getByText("Fred Rivett")).toBeInTheDocument();
    expect(screen.getByText("@fred")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/@fred");
  });

  it("shows the status, rating, dates and each paragraph of the review", () => {
    render(<ReaderReview reader={reader} review={full} />);
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Rated 3.5 out of 5" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nov 2023 – 19 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText("Fascinating.")).toBeInTheDocument();
    expect(screen.getByText("And a little terrifying.")).toBeInTheDocument();
  });

  it("closes up around a missing rating and review", () => {
    render(
      <ReaderReview
        reader={reader}
        review={{ ...full, rating: null, review: null }}
      />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("blockquote")).not.toBeInTheDocument();
    expect(screen.queryByText(/bookshelf/)).not.toBeInTheDocument();
  });

  it("says the book is on their shelf when there's nothing else", () => {
    render(<ReaderReview reader={reader} review={empty} />);
    expect(screen.getByText("On Fred Rivett's bookshelf.")).toBeInTheDocument();
  });

  it("uses the handle alone for a reader without a name", () => {
    render(
      <ReaderReview
        reader={{ ...reader, firstName: null, lastName: null }}
        review={empty}
      />,
    );
    expect(screen.getAllByText("@fred")).toHaveLength(1);
  });
});
