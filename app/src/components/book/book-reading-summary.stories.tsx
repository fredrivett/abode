import type { Meta, StoryObj } from "@storybook/react";
import type { BookDetails } from "@/lib/types/item";
import { BookReadingSummary } from "./book-reading-summary";

const baseBook: BookDetails = {
  authors: ["Ursula K. Le Guin"],
  publisher: "Ace Books",
  publishedAt: null,
  isbn: null,
  pageCount: 304,
  domain: "goodreads.com",
  status: null,
  startedAt: null,
  startedAtPrecision: null,
  finishedAt: null,
  finishedAtPrecision: null,
  progressValue: null,
  progressUnit: "page",
  progressUpdatedAt: null,
  rating: null,
  review: null,
};

const meta = {
  title: "Book/BookReadingSummary",
  component: BookReadingSummary,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: { bookDetails: baseBook },
} satisfies Meta<typeof BookReadingSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Read with a rating, date range, and review — the full public shape. */
export const Full: Story = {
  args: {
    bookDetails: {
      ...baseBook,
      status: "read",
      startedAt: "2026-06-01T00:00:00.000Z",
      startedAtPrecision: "day",
      finishedAt: "2026-07-01T00:00:00.000Z",
      finishedAtPrecision: "day",
      rating: 9,
      review:
        "A quiet, generous book about difference and trust. The ansible as a metaphor for honest communication has stuck with me for years.",
    },
  },
};

/** Status + rating only, no review or dates. */
export const RatingOnly: Story = {
  args: { bookDetails: { ...baseBook, status: "read", rating: 8 } },
};

/** Want to read — just the status badge. */
export const WantToRead: Story = {
  args: { bookDetails: { ...baseBook, status: "want_to_read" } },
};

/** A review with a partial-precision finished date (year only). */
export const ReviewWithYearOnly: Story = {
  args: {
    bookDetails: {
      ...baseBook,
      status: "read",
      finishedAt: "2019-01-01T00:00:00.000Z",
      finishedAtPrecision: "year",
      rating: 10,
      review: "Still my favourite.",
    },
  },
};
