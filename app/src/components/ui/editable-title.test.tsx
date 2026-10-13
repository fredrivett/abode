import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditableTitle } from "./editable-title";

function editAndCommit({ value, draft }: { value: string; draft: string }) {
  const onSubmit = vi.fn();
  render(<EditableTitle value={value} onSubmit={onSubmit} />);
  const input = screen.getByRole("textbox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: draft } });
  fireEvent.keyDown(input, { key: "Enter" });
  return onSubmit;
}

describe("EditableTitle", () => {
  it("submits the trimmed draft", () => {
    const onSubmit = editAndCommit({ value: "Old", draft: "  New  " });
    expect(onSubmit).toHaveBeenCalledWith("New");
  });

  it("saves when the edit only strips stray whitespace", () => {
    const onSubmit = editAndCommit({ value: " Title", draft: "Title" });
    expect(onSubmit).toHaveBeenCalledWith("Title");
  });

  it("skips an unchanged title", () => {
    const onSubmit = editAndCommit({ value: "Title", draft: "Title " });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("skips an empty title", () => {
    const onSubmit = editAndCommit({ value: "Title", draft: "   " });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
