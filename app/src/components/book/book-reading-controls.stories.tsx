import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BookDetails } from "@/lib/types/item";
import { BookReadingControls } from "./book-reading-controls";

const queryClient = new QueryClient();

const baseBook: BookDetails = {
  authors: ["Ursula K. Le Guin"],
  publisher: "Ace Books",
  publishedAt: null,
  isbn: "9780441478125",
  pageCount: 304,
  domain: "goodreads.com",
  status: null,
  startedAt: null,
  finishedAt: null,
  progressValue: null,
  progressUnit: "page",
  progressUpdatedAt: null,
  rating: null,
};

const meta = {
  title: "Book/BookReadingControls",
  component: BookReadingControls,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  // Persists via React Query invalidation on save (a no-op in Storybook)
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="w-72">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: { itemId: "book-1", bookDetails: baseBook },
} satisfies Meta<typeof BookReadingControls>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Saved but not tracked — only the status control shows. */
export const NotTracked: Story = {};

export const WantToRead: Story = {
  args: { bookDetails: { ...baseBook, status: "want_to_read" } },
};

/** Reading with a known page count — page/percent progress toggle + rating. */
export const Reading: Story = {
  args: {
    bookDetails: {
      ...baseBook,
      status: "reading",
      startedAt: "2026-07-20T00:00:00.000Z",
      progressValue: 132,
      progressUnit: "page",
    },
  },
};

/** Reading a book with no page count — progress is percent-only. */
export const ReadingNoPageCount: Story = {
  args: {
    bookDetails: {
      ...baseBook,
      pageCount: null,
      status: "reading",
      progressValue: 40,
      progressUnit: "percent",
    },
  },
};

/** Finished — shows finished date and a rating (4.5★ stored as 9/10). */
export const Read: Story = {
  args: {
    bookDetails: {
      ...baseBook,
      status: "read",
      startedAt: "2026-06-01T00:00:00.000Z",
      finishedAt: "2026-07-01T00:00:00.000Z",
      rating: 10,
    },
  },
};

export const DidNotFinish: Story = {
  args: {
    bookDetails: {
      ...baseBook,
      status: "dnf",
      startedAt: "2026-05-01T00:00:00.000Z",
      finishedAt: "2026-05-10T00:00:00.000Z",
    },
  },
};
