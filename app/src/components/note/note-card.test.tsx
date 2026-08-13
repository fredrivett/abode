import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoteCard } from "./note-card";

describe("NoteCard", () => {
  it("clamps the title as a heading when a body follows it", () => {
    render(<NoteCard title="My heading" content="Some body text." />);
    expect(screen.getByText("My heading")).toHaveClass("line-clamp-2");
    expect(screen.getByText("Some body text.")).toBeInTheDocument();
  });

  it("renders a title-only note's title unclamped so it can be the content", () => {
    render(<NoteCard title="A long title with no body at all" content="" />);
    // Not clamped: the title grows to fill the card (height comes from the grid)
    expect(
      screen.getByText("A long title with no body at all"),
    ).not.toHaveClass("line-clamp-2");
  });

  it("shows the empty-note placeholder with no title or body", () => {
    render(<NoteCard title={null} content="" />);
    expect(screen.getByText("Empty note")).toBeInTheDocument();
  });
});
