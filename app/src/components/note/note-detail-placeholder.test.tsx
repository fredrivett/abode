import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoteDetailPlaceholder } from "./note-detail-placeholder";

describe("NoteDetailPlaceholder", () => {
  it("shows the note's content, rendered as markdown", () => {
    render(
      <NoteDetailPlaceholder
        content={"# Shopping\n\n- **eggs**\n- milk"}
        canEdit
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Shopping" }),
    ).toBeInTheDocument();
    expect(screen.getByText("eggs").tagName).toBe("STRONG");
    expect(screen.getByText("milk")).toBeInTheDocument();
  });

  it("keeps the prose styles on a single-paragraph note", () => {
    render(<NoteDetailPlaceholder content="Just one paragraph." canEdit />);
    expect(
      screen.getByText("Just one paragraph.").closest(".note-prose"),
    ).not.toBeNull();
  });

  it("reserves the editor's status footer only when the note is editable", () => {
    const { container, rerender } = render(
      <NoteDetailPlaceholder content="hi" canEdit />,
    );
    const footer = () => container.querySelector(".justify-end");
    expect(footer()).not.toBeNull();
    rerender(<NoteDetailPlaceholder content="hi" canEdit={false} />);
    expect(footer()).toBeNull();
  });
});
