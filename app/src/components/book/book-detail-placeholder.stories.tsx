import type { Meta, StoryObj } from "@storybook/nextjs";
import type { BookDetails } from "@/lib/types/item";
import { BookDetailPlaceholder } from "./book-detail-placeholder";

// Only authors are read; the rest of BookDetails isn't needed for the story
const bookDetails = {
  authors: ["Ursula K. Le Guin"],
} as unknown as BookDetails;

// Coverless, so the story renders offline (covers go through the image proxy)
const meta = {
  title: "Book/BookDetailPlaceholder",
  component: BookDetailPlaceholder,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: { itemId: "book-1", bookDetails, title: "The Dispossessed" },
} satisfies Meta<typeof BookDetailPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
