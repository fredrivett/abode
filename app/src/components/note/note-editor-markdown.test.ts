import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  joinNoteTitle,
  promoteNoteHeading,
  splitNoteTitle,
} from "@/lib/items/note-title";
import { noteEditorExtensions } from "./note-editor";

let editor: Editor | undefined;

afterEach(() => editor?.destroy());

function roundTrip(markdown: string, titleFirst = false): Editor {
  editor = new Editor({
    extensions: noteEditorExtensions({ titleFirst }),
    content: markdown,
    contentType: "markdown",
  });
  return editor;
}

describe("note editor markdown", () => {
  it("parses checklists into task items with their checked state", () => {
    const { state } = roundTrip("- [ ] milk\n- [x] eggs");
    const list = state.doc.firstChild;
    expect(list?.type.name).toBe("taskList");
    expect(list?.childCount).toBe(2);
    expect(list?.child(0).attrs.checked).toBe(false);
    expect(list?.child(1).attrs.checked).toBe(true);
  });

  it("round-trips checklists, including nested items, unchanged", () => {
    const markdown = "- [ ] milk\n- [x] eggs\n  - [ ] free range";
    expect(roundTrip(markdown).getMarkdown()).toBe(markdown);
  });

  it("keeps checklists and bullet lists distinct", () => {
    const markdown = "- [ ] todo\n\n- plain";
    const editor = roundTrip(markdown);
    expect(editor.state.doc.child(0).type.name).toBe("taskList");
    expect(editor.state.doc.child(1).type.name).toBe("bulletList");
  });

  it("supports checklists after the title line", () => {
    const editor = roundTrip("# Shopping\n\n- [x] bread", true);
    expect(editor.state.doc.child(1).type.name).toBe("taskList");
    expect(editor.getMarkdown()).toBe("# Shopping\n\n- [x] bread");
  });
});

describe("title-first trailing node", () => {
  // The trailing-node plugin runs on the first transaction after load, e.g. a
  // click into the composer
  function afterFirstTransaction(markdown: string): Editor {
    const loaded = roundTrip(markdown, true);
    loaded.view.dispatch(loaded.state.tr);
    return loaded;
  }

  it.each([
    "# Draft title\n\nUnsaved thoughts to keep.",
    "# Draft title\n\nUnsaved thoughts to keep.\n\n",
    "# Draft title",
  ])(
    "leaves a draft ending in a paragraph or its title as loaded: %j",
    (markdown) => {
      expect(afterFirstTransaction(markdown).getMarkdown()).toBe(markdown);
    },
  );

  it("trails a list with a paragraph, never an empty heading", () => {
    const { state } = afterFirstTransaction("# Shopping\n\n- [ ] milk");
    expect(state.doc.lastChild?.type.name).toBe("paragraph");
  });
});

describe("saved note title in the title-first editor", () => {
  // What the detail view saves after loading a note and editing nothing
  const reloaded = (note: { title: string | null; content: string }) =>
    splitNoteTitle(roundTrip(joinNoteTitle(note), true).getMarkdown());

  it.each([
    { title: "Trip ideas", content: "Lisbon, Porto\n\n- [ ] book flights" },
    { title: "notes_v2 [1] *draft* #3 & <b>", content: "body" },
    { title: "Untouched body", content: "" },
    { title: null, content: "## Not the title\n\nbody" },
    { title: null, content: "" },
  ])("keeps the title and body as stored: %j", (note) => {
    expect(reloaded(note)).toEqual(note);
  });

  it("reads an emptied title line as no title", () => {
    const editor = roundTrip(
      joinNoteTitle({ title: "Trip ideas", content: "Lisbon" }),
      true,
    );
    const title = editor.state.doc.firstChild;
    editor.commands.deleteRange({
      from: 1,
      to: 1 + (title?.content.size ?? 0),
    });
    expect(splitNoteTitle(editor.getMarkdown())).toEqual({
      title: null,
      content: "Lisbon",
    });
  });
});

describe("typed title line", () => {
  // Text typed into the composer's empty title line
  function typeTitle(text: string): Editor {
    const editor = roundTrip("#", true);
    editor.view.dispatch(editor.state.tr.insertText(text, 1));
    return editor;
  }

  it("is stored as typed when the note is created", () => {
    const typed = "Q&A: notes_v2 *x* [1] a < b";
    const markdown = typeTitle(typed).getMarkdown();
    expect(promoteNoteHeading(markdown).title).toBe(typed);
    // and shows as typed when the saved note opens in the editor
    expect(
      splitNoteTitle(
        roundTrip(
          joinNoteTitle({ title: typed, content: "" }),
          true,
        ).getMarkdown(),
      ).title,
    ).toBe(typed);
  });

  it("drops formatting, which the plain-text title can't keep", () => {
    const editor = typeTitle("Plan see https://example.com");
    editor.chain().setTextSelection({ from: 1, to: 5 }).toggleBold().run();
    expect(editor.getMarkdown()).toBe("# Plan see https://example.com");
  });

  it("keeps a line break's text in the title", () => {
    const editor = typeTitle("One");
    editor
      .chain()
      .setTextSelection(4)
      .setHardBreak()
      .insertContent("Two")
      .run();
    expect(splitNoteTitle(editor.getMarkdown()).title).toBe("One Two");
  });
});
