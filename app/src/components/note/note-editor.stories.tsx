import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { NoteCard } from "@/components/note/note-card";
import { NoteEditor } from "@/components/note/note-editor";

const meta = {
  title: "Note/NoteEditor",
  component: NoteEditor,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-prose rounded-lg border p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NoteEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

const SAMPLE = `# Weekly review

Things that went **well** this week:

- Shipped the note item type
- Cleared the review backlog

Things to improve:

1. Smaller PRs
2. More tests

> Markdown is the source of truth — this renders the same way the
> article reader does.`;

export const Editable: Story = {
  args: {
    content: SAMPLE,
    editable: true,
  },
};

export const ReadOnly: Story = {
  args: {
    content: SAMPLE,
    editable: false,
  },
};

const LIST_ITEMS = [
  "Book the van",
  "Pack the kitchen — plates, glasses and anything else that might break",
  "Return the keys",
];

export const Checklist: Story = {
  args: {
    content: `# Moving day

${LIST_ITEMS.map((item, index) => `- [${index === 0 ? "x" : " "}] ${item}`).join("\n")}
  - [ ] Nested task`,
    editable: true,
  },
};

const toList = (marker: string) =>
  `${LIST_ITEMS.map((item) => `${marker}${item}`).join("\n")}\n  ${marker}Nested`;

// A checklist and a bullet list of the same items, side by side: they must
// line up — same indent, text start and row heights — so switching a list
// between the two moves nothing
export const ChecklistMatchesBulletList: Story = {
  args: { content: "" },
  render: () => (
    <div className="grid grid-cols-2 gap-6">
      <NoteEditor content={toList("- ")} />
      <NoteEditor content={toList("- [ ] ")} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [bullets, checklist] = await waitFor(() => {
      const lists = canvasElement.querySelectorAll(".ProseMirror > ul");
      if (lists.length !== 2) throw new Error("not ready");
      return [...lists];
    });
    // Every item, nested included, in document order
    const rows = (list: Element) =>
      [...list.querySelectorAll("li")].map((item) => {
        const rect = item.getBoundingClientRect();
        const text = item.querySelector("p")?.getBoundingClientRect();
        return { top: rect.top, height: rect.height, textLeft: text?.left };
      });
    const bulletRows = rows(bullets);
    const checklistRows = rows(checklist);
    const listLeft = (list: Element) => list.getBoundingClientRect().left;
    checklistRows.forEach((row, index) => {
      const bullet = bulletRows[index];
      expect(row.height).toBeCloseTo(bullet.height, 1);
      expect(row.top - checklist.getBoundingClientRect().top).toBeCloseTo(
        bullet.top - bullets.getBoundingClientRect().top,
        1,
      );
      expect((row.textLeft ?? 0) - listLeft(checklist)).toBeCloseTo(
        (bullet.textLeft ?? 0) - listLeft(bullets),
        1,
      );
    });
  },
};

const NESTED_LISTS = `- Pack the kitchen
  - Plates
    - The good ones
  - Glasses
- Return the keys

1. Book the van
   1. Check the size
2. Load up

- [ ] Clean the flat
  - [x] Oven
  - [ ] Windows
- [x] Pay the deposit`;

/**
 * The gap between each list item's text and the next one's, per top-level
 * list, in document order. Measured from text line boxes (not the item boxes,
 * which contain their nested lists), skipping the checkbox's hidden label.
 */
function listItemGaps(root: Element): number[][] {
  return [...root.querySelectorAll(":scope > ul, :scope > ol")].map((list) => {
    const lines = [...list.querySelectorAll("li")].map((item) => {
      const rects: DOMRect[] = [];
      const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        // Skip the checkbox's hidden state text (editor label / rendered box)
        if (
          parent?.closest("li") !== item ||
          parent.closest("label, [data-task-checkbox]")
        ) {
          continue;
        }
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        rects.push(...range.getClientRects());
      }
      return {
        top: Math.min(...rects.map((rect) => rect.top)),
        bottom: Math.max(...rects.map((rect) => rect.bottom)),
      };
    });
    return lines.slice(1).map((line, index) => line.top - lines[index].bottom);
  });
}

// Nesting keeps the list's rhythm: a nested item sits the same gap below its
// parent as siblings do, and the list resumes at that gap after it — in the
// editor and on the card alike
export const NestedListRhythm: Story = {
  args: { content: "" },
  render: () => (
    <div className="grid grid-cols-2 items-start gap-6">
      <NoteEditor content={NESTED_LISTS} />
      <div style={{ height: 520 }}>
        <NoteCard title={null} content={NESTED_LISTS} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const roots = await waitFor(() => {
      const found = canvasElement.querySelectorAll(".note-prose");
      if (found.length !== 2 || !found[0].matches(".ProseMirror")) {
        throw new Error("not ready");
      }
      return [...found];
    });
    const [editorGaps, cardGaps] = roots.map(listItemGaps);
    const expected = editorGaps[0][0];
    for (const gaps of [editorGaps, cardGaps]) {
      expect(gaps).toHaveLength(3);
      for (const gap of gaps.flat()) expect(gap).toBeCloseTo(expected, 1);
    }
  },
};

export const Empty: Story = {
  args: {
    content: "",
    editable: true,
    autoFocus: true,
  },
};

// Real-browser check of the change contract (jsdom can't type into
// ProseMirror): mounting must not report a change — that autosaved every
// opened note — while an actual edit must
export const ReportsEdits: Story = {
  args: {
    content: "Hello",
    editable: true,
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const editor = await waitFor(() => {
      const element = canvasElement.querySelector(".ProseMirror");
      if (!(element instanceof HTMLElement)) throw new Error("not ready");
      return element;
    });
    expect(args.onChange).not.toHaveBeenCalled();

    await userEvent.click(editor);
    await userEvent.keyboard("world");
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith(
        expect.stringContaining("world"),
      ),
    );
  },
};

// Typing the markdown syntax starts a checklist (jsdom can't type into
// ProseMirror, so this runs in the browser). `- ` makes a bullet first, so the
// `[ ] ` that follows is the in-bullet rule converting it
export const TypingStartsChecklist: Story = {
  args: {
    content: "",
    editable: true,
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const editor = await waitFor(() => {
      const element = canvasElement.querySelector(".ProseMirror");
      if (!(element instanceof HTMLElement)) throw new Error("not ready");
      return element;
    });
    await userEvent.click(editor);
    // `[` opens a userEvent descriptor, so it's escaped as `[[`
    await userEvent.keyboard("- [[ ] milk{Enter}eggs");
    // Trailing whitespace: StarterKit keeps an empty paragraph after the list
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith(
        expect.stringMatching(/^- \[ \] milk\n- \[ \] eggs\s*$/),
      ),
    );
    expect(editor.querySelectorAll("li[data-checked]")).toHaveLength(2);
  },
};

// Starting a checklist from an existing bullet list: `[ ] ` at the start of a
// new bullet turns just that item into a checklist item
export const TypingInBulletStartsChecklist: Story = {
  args: {
    content: "- bread",
    editable: true,
    // Caret at the end of "bread"
    autoFocus: true,
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const editor = await waitFor(() => {
      const element = canvasElement.querySelector(".ProseMirror");
      if (!(element instanceof HTMLElement)) throw new Error("not ready");
      return element;
    });
    await waitFor(() => expect(editor).toHaveFocus());
    await userEvent.keyboard("{Enter}[[ ] milk");
    await waitFor(() =>
      expect(args.onChange).toHaveBeenLastCalledWith(
        expect.stringMatching(/^- bread\n\n- \[ \] milk\s*$/),
      ),
    );
    expect(editor.querySelectorAll("li[data-checked]")).toHaveLength(1);
  },
};

const LINKED = `Reading list: [the essay](https://example.com/essay) and
[a second one](https://example.com/second).`;

// Clicking a link while editing places the caret; it must not navigate.
// ⌘/Ctrl-click opens it in a new tab
export const WithLinks: Story = {
  args: {
    content: LINKED,
    editable: true,
  },
  play: async ({ canvasElement }) => {
    const open = fn();
    const originalOpen = window.open;
    window.open = open;
    try {
      const link = await waitFor(() => {
        const element = canvasElement.querySelector(".ProseMirror a");
        if (!(element instanceof HTMLElement)) throw new Error("not ready");
        return element;
      });
      // ProseMirror resolves clicks by coordinates, so click on the link itself
      const rect = link.getBoundingClientRect();
      const coords = {
        clientX: rect.left + 4,
        clientY: rect.top + rect.height / 2,
      };
      const user = userEvent.setup();

      await user.pointer({ keys: "[MouseLeft]", target: link, coords });
      expect(open).not.toHaveBeenCalled();

      await user.keyboard("{Meta>}");
      await user.pointer({ keys: "[MouseLeft]", target: link, coords });
      await user.keyboard("{/Meta}");
      expect(open).toHaveBeenCalledWith(
        "https://example.com/essay",
        "_blank",
        "noopener,noreferrer",
      );
    } finally {
      window.open = originalOpen;
    }
  },
};

export const ReadOnlyWithLinks: Story = {
  args: {
    content: LINKED,
    editable: false,
  },
};
