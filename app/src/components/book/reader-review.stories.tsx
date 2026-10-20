import type { Meta, StoryObj } from "@storybook/nextjs";
import { STORY_NO_READING, STORY_REVIEW } from "./book-review-fixtures";
import { ReaderReview } from "./reader-review";

const meta = {
  title: "Book/ReaderReview",
  component: ReaderReview,
  tags: ["autodocs"],
  args: {
    reader: {
      username: "fred",
      firstName: "Fred",
      lastName: "Rivett",
      avatarUrl: null,
    },
    review: STORY_REVIEW,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReaderReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {};

export const RatingOnly: Story = {
  args: { review: { ...STORY_REVIEW, review: null } },
};

export const ReviewOnly: Story = {
  args: {
    review: {
      ...STORY_NO_READING,
      review: "Bleak, precise, unforgettable.",
    },
  },
};

export const CurrentlyReading: Story = {
  args: {
    review: {
      ...STORY_NO_READING,
      status: "reading",
      startedAt: "2026-10-01T00:00:00.000Z",
      startedAtPrecision: "month",
    },
  },
};

export const NothingYet: Story = {
  args: { review: STORY_NO_READING },
};

export const HandleOnly: Story = {
  args: {
    reader: {
      username: "fred",
      firstName: null,
      lastName: null,
      avatarUrl: null,
    },
  },
};
