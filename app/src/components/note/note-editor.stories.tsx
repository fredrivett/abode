import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor } from "storybook/test";

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

// Typing the markdown syntax starts a checklist, inside a bullet too (jsdom
// can't type into ProseMirror, so this runs in the browser)
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
