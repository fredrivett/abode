import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LazyNoteEditor } from "./lazy-note-editor";

const { load } = vi.hoisted(() => ({ load: { fail: true } }));

vi.mock("posthog-js", () => ({ default: { captureException: vi.fn() } }));
vi.mock("./note-editor", () => {
  if (load.fail) {
    load.fail = false;
    throw new Error("ChunkLoadError");
  }
  return { NoteEditor: () => <div>editor loaded</div> };
});

describe("LazyNoteEditor", () => {
  it("offers a retry when the editor fails to download, then loads it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<LazyNoteEditor content="" onChange={() => {}} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /couldn't load the editor/i }),
    );
    expect(await screen.findByText("editor loaded")).toBeInTheDocument();
  });

  it("shows the draft as text while the editor downloads", async () => {
    render(<LazyNoteEditor content="# Groceries" onChange={() => {}} />);
    // A fresh lazy always suspends on first render: the import is still pending
    expect(screen.getByText("# Groceries")).toBeInTheDocument();
    expect(screen.queryByText("editor loaded")).toBeNull();
    // ...and the editor replaces the draft once it arrives
    expect(await screen.findByText("editor loaded")).toBeInTheDocument();
    expect(screen.queryByText("# Groceries")).toBeNull();
  });
});
