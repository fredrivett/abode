import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoteCard } from "./note-card";
import { NOTE_PROSE_FONT_SIZE } from "./note-prose";

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

  it("keeps the prose styles on a single-paragraph body", () => {
    // markdown-to-jsx drops the wrapper (and its class and font size) around a
    // lone block unless forced, so the text rendered larger than estimated
    render(<NoteCard title={null} content="Just one paragraph." />);
    const prose = screen
      .getByText("Just one paragraph.")
      .closest(".note-prose");
    expect(prose).not.toBeNull();
    expect(prose).toHaveStyle({ fontSize: NOTE_PROSE_FONT_SIZE });
  });

  it("shows the empty-note placeholder with no title or body", () => {
    render(<NoteCard title={null} content="" />);
    expect(screen.getByText("Empty note")).toBeInTheDocument();
  });

  it("draws checklist items as inert boxes, not inputs inside the button", () => {
    const { container } = render(
      <NoteCard title={null} content={"- [ ] milk\n- [x] eggs"} />,
    );
    expect(container.querySelector("input")).toBeNull();
    const boxes = container.querySelectorAll("[data-task-checkbox]");
    expect([...boxes].map((box) => box.getAttribute("data-checked"))).toEqual([
      "false",
      "true",
    ]);
    // The state is announced with the item, since the box itself is visual
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "Unchecked: milk Checked: eggs",
    );
  });
});
