import type { Meta, StoryObj } from "@storybook/nextjs";
import { NoteDetailPlaceholder } from "./note-detail-placeholder";

const SAMPLE = `# Weekly review

Things that went **well** this week:

- Shipped the note item type
- Cleared the review backlog

> Markdown is the source of truth.`;

// Read-only by design: this is the brief stand-in shown while the note editor
// (a large lazy chunk) loads, before the editor replaces it in place. For the
// editable note, see Note/NoteEditor.
const meta = {
  title: "Note/NoteDetailPlaceholder",
  component: NoteDetailPlaceholder,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Read-only stand-in shown while the note editor loads: the note's text in the editor's layout, so the editor takes over in place. Not editable — see Note/NoteEditor for the editor.",
      },
    },
  },
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

// For the note's owner: reserves the editor's "Saving" status row
export const ForOwner: Story = {};

// For a viewer who can't edit: no status row
export const ForViewer: Story = { args: { canEdit: false } };
