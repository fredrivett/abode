import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BookDetails } from "@/lib/types/item";
import { BookDetailPlaceholder } from "./book-detail-placeholder";

const book = (authors: string[]) => ({ authors }) as unknown as BookDetails;

describe("BookDetailPlaceholder", () => {
  it("shows the title and authors", () => {
    render(
      <BookDetailPlaceholder
        itemId="b1"
        bookDetails={book(["Ursula K. Le Guin", "Someone Else"])}
        title="The Dispossessed"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "The Dispossessed" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ursula K. Le Guin, Someone Else"),
    ).toBeInTheDocument();
  });

  it("renders the cover only when there is one", () => {
    const { rerender } = render(
      <BookDetailPlaceholder itemId="b1" bookDetails={book([])} title="T" />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    rerender(
      <BookDetailPlaceholder
        itemId="b1"
        bookDetails={book([])}
        title="T"
        coverFileKey="covers/b1.jpg"
      />,
    );
    expect(screen.getByRole("img", { name: "T" })).toBeInTheDocument();
  });

  it("includes the source link, like the view it stands in for", () => {
    const { rerender } = render(
      <BookDetailPlaceholder
        itemId="b1"
        bookDetails={book([])}
        title="T"
        sourceUrl="https://literal.club/book/t"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://literal.club/book/t",
    );
    rerender(
      <BookDetailPlaceholder
        itemId="b1"
        bookDetails={book([])}
        title="T"
        sourceUrl="not a url"
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
