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
