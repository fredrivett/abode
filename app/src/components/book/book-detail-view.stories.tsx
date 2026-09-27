import type { Meta, StoryObj } from "@storybook/nextjs";
import type { BookDetails } from "@/lib/types/item";
import { BookDetailView } from "./book-detail-view";

// Only authors/domain are read; the rest of BookDetails isn't needed here
const bookDetails = {
  authors: ["Ursula K. Le Guin"],
  domain: "literal.club",
} as unknown as BookDetails;

// Coverless, so the stories render offline (covers go through the image
// proxy); see Book/BookCover3D for the cover itself
const meta = {
  title: "Book/BookDetailView",
  component: BookDetailView,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: { itemId: "book-1", bookDetails, title: "The Dispossessed" },
  decorators: [
    (Story) => (
      <div className="h-[32rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSourceLink: Story = {
  args: { sourceUrl: "https://literal.club/book/the-dispossessed" },
};

export const MultipleAuthors: Story = {
  args: {
    bookDetails: {
      ...bookDetails,
      authors: ["Terry Pratchett", "Neil Gaiman"],
    },
    title: "Good Omens",
  },
};
