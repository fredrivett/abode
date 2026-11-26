import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NoteDraftDialogBody } from "./_components/note-draft-dialog-body";
import { NoteComposer } from "./note-composer";
import { NoteDraftProvider } from "./note-draft-context";

// The URL-driven item dialog, as plain state the harness below drives
const itemDialog = vi.hoisted(() => ({
  composingNote: false,
  openItem: vi.fn(),
  replaceOpenItem: vi.fn(),
}));
vi.mock("./item-dialog-context", () => ({ useItemDialog: () => itemDialog }));

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({
  api: { post, delete: vi.fn(() => Promise.resolve()) },
}));
vi.mock("@/lib/api-hooks", () => ({ useRevealCreatedItem: () => vi.fn() }));
// A plain field standing in for the editor: mounts with its content and
// each change emits its markdown
vi.mock("@/components/note/lazy-note-editor", () => ({
  LazyNoteEditor: ({
    content,
    onChange,
  }: {
    content: string;
    onChange: (markdown: string) => void;
  }) => (
    <textarea
      aria-label="note"
      defaultValue={content}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

/**
 * The composer card plus the dialog's draft mode, as the dashboard mounts
 * them: `?item=new` opens the dialog on the draft, and pointing the dialog at
 * the saved note leaves draft mode.
 */
function Dashboard({ initialDraft = null }: { initialDraft?: string | null }) {
  const [queryClient] = useState(() => new QueryClient());
  const [composing, setComposing] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  itemDialog.composingNote = composing;
  itemDialog.openItem.mockImplementation((id: string) =>
    setComposing(id === "new"),
  );
  itemDialog.replaceOpenItem.mockImplementation((id: string) => {
    setComposing(false);
    setOpenItemId(id);
  });
  return (
    <QueryClientProvider client={queryClient}>
      <NoteDraftProvider initialDraft={initialDraft}>
        <NoteComposer />
        <Dialog
          open={composing}
          onOpenChange={(open) => !open && setComposing(false)}
        >
          <DialogContent aria-describedby={undefined}>
            <NoteDraftDialogBody />
          </DialogContent>
        </Dialog>
        {openItemId && <output aria-label="open item">{openItemId}</output>}
      </NoteDraftProvider>
    </QueryClientProvider>
  );
}

const cardField = () => screen.getAllByLabelText("note")[0];

const draftWrites = () =>
  post.mock.calls
    .filter(([url]) => url === "/api/v1/note-draft")
    .map(([, body]) => body.content);

function edit(markdown: string) {
  fireEvent.change(cardField(), {
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
    render(<Dashboard initialDraft={"# Trip\n\nLisbon"} />);
    edit("# Trip\n\nLisbon, Porto");
    edit("# Trip\n\nLisbon\n\n");
    expect(draftWrites()).toEqual([
      "# Trip\n\nLisbon, Porto",
      "# Trip\n\nLisbon\n\n",
    ]);
  });

  it("keeps a newer write of the same text when an older one fails", async () => {
    let failFirst = (_error: Error) => {};
    post.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        failFirst = reject;
      }),
    );
    render(<Dashboard initialDraft={"# Trip\n\nLisbon"} />);
    edit("# Trip\n\nLisbon, Porto");
    edit("# Trip\n\nLisbon, Faro");
    edit("# Trip\n\nLisbon, Porto");
    await act(async () => failFirst(new Error("offline")));
    // The last write sent still lands, so going back to the loaded text is an edit
    edit("# Trip\n\nLisbon");
    expect(draftWrites().at(-1)).toBe("# Trip\n\nLisbon");
  });

  it("doesn't write a change that only adds trailing blank lines", () => {
    render(<Dashboard initialDraft={"# Shopping\n\n- [ ] milk"} />);
    edit("# Shopping\n\n- [ ] milk\n\n");
    expect(draftWrites()).toEqual([]);
  });
});

describe("NoteComposer expanded in the item dialog", () => {
  beforeEach(() => {
    post.mockReset().mockReturnValue(new Promise(() => {}));
  });

  it("carries the text into the dialog and back out again", () => {
    render(<Dashboard />);
    fireEvent.change(cardField(), { target: { value: "# Trip\n\nLisbon" } });
    fireEvent.click(screen.getByRole("button", { name: "Expand note" }));
    expect(itemDialog.openItem).toHaveBeenCalledWith("new");
    const dialogField = within(screen.getByRole("dialog")).getByLabelText(
      "note",
    );
    expect(dialogField).toHaveValue("# Trip\n\nLisbon");

    fireEvent.change(dialogField, {
      target: { value: "# Trip\n\nLisbon, Porto" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cardField()).toHaveValue("# Trip\n\nLisbon, Porto");
  });
});

describe("NoteComposer save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post
      .mockReset()
      .mockImplementation((url: string) =>
        Promise.resolve(url === "/api/v1/items/notes" ? { id: "note-1" } : {}),
      );
  });

  it("turns the dialog into the saved note's when saved there", async () => {
    render(<Dashboard initialDraft={"# Trip\n\nLisbon"} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand note" }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Save",
        }),
      );
    });
    expect(post).toHaveBeenCalledWith("/api/v1/items/notes", {
      content: "# Trip\n\nLisbon",
    });
    // In place: no new history entry, so Back still closes it
    expect(itemDialog.replaceOpenItem).toHaveBeenCalledWith("note-1");
    expect(itemDialog.openItem).not.toHaveBeenCalledWith("note-1");
    expect(screen.getByLabelText("open item")).toHaveTextContent("note-1");
    // The card is empty again for the next note
    expect(cardField()).toHaveValue("");
  });

  it("stays in the grid when saved from the card", async () => {
    render(<Dashboard initialDraft={"# Trip\n\nLisbon"} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(post).toHaveBeenCalledWith("/api/v1/items/notes", {
      content: "# Trip\n\nLisbon",
    });
    expect(itemDialog.replaceOpenItem).not.toHaveBeenCalled();
    expect(cardField()).toHaveValue("");
  });
});
