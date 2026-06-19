import type { Meta, StoryObj } from "@storybook/react";

import { NoteCard } from "@/components/note/note-card";

const meta = {
  title: "Note/NoteCard",
  component: NoteCard,
  parameters: {
    layout: "centered",
  },
  // Notes are coverless text cards; render at a representative grid size
  decorators: [
    (Story) => (
      <div style={{ width: 260, height: 325 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NoteCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const SAMPLE = `Spoke to Sarah about the onboarding flow today.

Key takeaways:
- New users drop off at the empty dashboard
- A "take a note" prompt could give them something to do
- Worth A/B testing the first-run experience

Follow up next week.`;

export const TitleAndBody: Story = {
  args: {
    title: "Onboarding ideas",
    content: SAMPLE,
  },
};

export const BodyOnly: Story = {
  args: {
    title: null,
    content: SAMPLE,
  },
};

export const ShortNote: Story = {
  args: {
    title: null,
    content: "Remember to cancel the trial before the 30th 💸",
  },
};

export const Empty: Story = {
  args: {
    title: null,
    content: "",
  },
};
