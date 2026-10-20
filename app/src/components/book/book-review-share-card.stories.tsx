import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  STORY_COVER_URL,
  STORY_NO_READING,
  STORY_REVIEW,
} from "./book-review-fixtures";
import { BookReviewCardPreview } from "./share-book-review-dialog";

// The share card a book review link unfurls to, shown through the same scaled
// preview the share dialog uses (the OG route renders the identical markup)
const meta = {
  title: "Book/BookReviewShareCard",
  component: BookReviewCardPreview,
  tags: ["autodocs"],
  args: {
    title: "Nineteen Eighty-Four",
    authors: ["George Orwell"],
    review: STORY_REVIEW,
    ownerUsername: "fred",
    coverUrl: STORY_COVER_URL,
    coverRatio: 2 / 3,
    coverColor: "#7f1d1d",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookReviewCardPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LongReview: Story = {};

export const ShortReview: Story = {
  args: {
    review: { ...STORY_REVIEW, review: "Bleak, precise, unforgettable." },
  },
};

export const RatingOnly: Story = {
  args: { review: { ...STORY_REVIEW, review: null } },
};

export const ReviewWithoutRating: Story = {
  args: { review: { ...STORY_REVIEW, rating: null } },
};

// Saved but not tracked: just the book and who has it
export const BookOnly: Story = {
  args: { review: STORY_NO_READING },
};

export const NoCover: Story = {
  args: {
    title: "The Left Hand of Darkness",
    authors: ["Ursula K. Le Guin"],
    coverUrl: null,
    coverColor: "#3b2f5c",
  },
};

export const NoCoverOrColor: Story = {
  args: { coverUrl: null, coverColor: null },
};

export const LongTitle: Story = {
  args: {
    title:
      "Thinking in Systems: A Primer on the Big Picture and Why Everything Is Connected",
    authors: ["Donella H. Meadows", "Diana Wright"],
  },
};
