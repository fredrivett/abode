import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
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
