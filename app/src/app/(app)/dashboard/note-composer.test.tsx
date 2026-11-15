import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoteComposer } from "./note-composer";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  api: { post, delete: vi.fn(() => Promise.resolve()) },
}));
vi.mock("@/lib/api-hooks", () => ({ useRevealCreatedItem: () => vi.fn() }));
// A plain field standing in for the editor: each change emits its markdown
vi.mock("@/components/note/lazy-note-editor", () => ({
  LazyNoteEditor: ({ onChange }: { onChange: (markdown: string) => void }) => (
    <textarea
      aria-label="note"
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const draftWrites = () =>
  post.mock.calls
    .filter(([url]) => url === "/api/v1/note-draft")
    .map(([, body]) => body.content);

function edit(markdown: string) {
  fireEvent.change(screen.getByLabelText("note"), {
    target: { value: markdown },
  });
  // Past the autosave debounce
  act(() => vi.advanceTimersByTime(1000));
}

describe("NoteComposer draft autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Writes stay in flight
    post.mockReset().mockReturnValue(new Promise(() => {}));
  });
  afterEach(() => vi.useRealTimers());

  it("writes an edit back to the loaded draft while an earlier write is in flight", () => {
    render(<NoteComposer initialDraft={"# Trip\n\nLisbon"} />);
    edit("# Trip\n\nLisbon, Porto");
    edit("# Trip\n\nLisbon\n\n");
    expect(draftWrites()).toEqual([
      "# Trip\n\nLisbon, Porto",
      "# Trip\n\nLisbon\n\n",
    ]);
  });

  it("doesn't write a change that only adds trailing blank lines", () => {
    render(<NoteComposer initialDraft={"# Shopping\n\n- [ ] milk"} />);
    edit("# Shopping\n\n- [ ] milk\n\n");
    expect(draftWrites()).toEqual([]);
  });
});
