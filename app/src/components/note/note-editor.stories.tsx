import type { Meta, StoryObj } from "@storybook/react";

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
