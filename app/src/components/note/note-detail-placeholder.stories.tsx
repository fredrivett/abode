import type { Meta, StoryObj } from "@storybook/nextjs";
import { NoteDetailPlaceholder } from "./note-detail-placeholder";

const SAMPLE = `# Weekly review

Things that went **well** this week:

- Shipped the note item type
- Cleared the review backlog

> Markdown is the source of truth.`;

const meta = {
  title: "Note/NoteDetailPlaceholder",
  component: NoteDetailPlaceholder,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: { content: SAMPLE, canEdit: true },
  decorators: [
    (Story) => (
      <div className="h-[32rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NoteDetailPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {};

export const ReadOnly: Story = { args: { canEdit: false } };
