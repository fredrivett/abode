import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteEditor } from "./note-editor";

describe("NoteEditor", () => {
  it("doesn't report a change just from mounting (opening a note must not autosave it)", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <NoteEditor content="Some **saved** text." onChange={onChange} />,
    );
    // Wait for TipTap to initialise (immediatelyRender: false) and run effects
    await waitFor(() =>
      expect(container.querySelector(".ProseMirror")).not.toBeNull(),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
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
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onChange).not.toHaveBeenCalled();
  });
});
