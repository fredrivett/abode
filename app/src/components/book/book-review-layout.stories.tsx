import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  STORY_COVER_URL,
  STORY_NO_READING,
  STORY_REVIEW,
} from "./book-review-fixtures";
import { BookReviewLayout } from "./book-review-layout";
import { ReaderReview } from "./reader-review";

const reader = {
  username: "fred",
  firstName: "Fred",
  lastName: "Rivett",
  avatarUrl: null,
};

const meta = {
  title: "Book/BookReviewLayout",
  component: BookReviewLayout,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    book: {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Nineteen Eighty-Four",
      authors: ["George Orwell"],
      publisher: "Secker & Warburg",
      publishedAt: "1949-06-08T00:00:00.000Z",
      pageCount: 328,
      coverUrl: STORY_COVER_URL,
      coverRatio: 2 / 3,
      coverColor: "#7f1d1d",
      sourceUrl: "https://openlibrary.org/isbn/9780141036144",
      domain: "openlibrary.org",
    },
    children: <ReaderReview reader={reader} review={STORY_REVIEW} />,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1024, margin: "0 auto" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookReviewLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithReview: Story = {};

// A future book page lists several readers' reviews under one book
export const SeveralReaders: Story = {
  args: {
    children: (
      <div className="space-y-6">
        <ReaderReview reader={reader} review={STORY_REVIEW} />
        <ReaderReview
          reader={{
            ...reader,
            username: "ana",
            firstName: "Ana",
            lastName: null,
          }}
          review={{ ...STORY_REVIEW, rating: 6, review: "Grim. Important." }}
        />
      </div>
    ),
  },
};

export const NoCover: Story = {
  args: {
    book: {
      id: "22222222-2222-4222-8222-222222222222",
      title: "The Left Hand of Darkness",
      authors: ["Ursula K. Le Guin"],
      publisher: null,
      publishedAt: null,
      pageCount: null,
      coverUrl: null,
      coverColor: "#3b2f5c",
      sourceUrl: null,
      domain: null,
    },
    children: <ReaderReview reader={reader} review={STORY_NO_READING} />,
  },
};
