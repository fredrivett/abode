import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteEditor } from "./note-editor";

describe("NoteEditor", () => {
  it("doesn't report a change just from mounting (opening a note must not autosave it)", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <NoteEditor content="Some **saved** text." onChange={onChange} />,
    );
    // TipTap initialises after mount (immediatelyRender: false); the effects
    // that could emit a change run in the commit that mounts .ProseMirror
    await waitFor(() =>
      expect(container.querySelector(".ProseMirror")).not.toBeNull(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("doesn't report a change when editability toggles", async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <NoteEditor content="Text" editable={false} onChange={onChange} />,
    );
    await waitFor(() =>
      expect(container.querySelector(".ProseMirror")).not.toBeNull(),
    );
    rerender(<NoteEditor content="Text" editable onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});
