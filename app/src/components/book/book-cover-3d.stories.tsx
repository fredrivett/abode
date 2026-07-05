import type { Meta, StoryObj } from "@storybook/react";

import { BOOK_TILE_PADDING_X, BOOK_TILE_PADDING_Y } from "@/lib/book-cover";
import { BookCover3D } from "./book-cover-3d";

const meta = {
  title: "Book/BookCover3D",
  component: BookCover3D,
  parameters: {
    layout: "centered",
  },
  args: {
    src: "https://covers.openlibrary.org/b/isbn/9780141036144-L.jpg",
    alt: "Nineteen Eighty-Four",
  },
} satisfies Meta<typeof BookCover3D>;

export default meta;

type Story = StoryObj<typeof meta>;

// Detail-view size (matches book-detail-view's max-w-[240px] hero)
export const Detail: Story = {
  decorators: [
    (Story) => (
      <div className="aspect-[2/3] w-[240px]">
        <Story />
      </div>
    ),
  ],
};

// Grid-tile treatment at a large tile width: the item-card surface with the
// shared padding fraction, so book pop-out vs padding can be eyeballed
export const GridTile: Story = {
  decorators: [
    (Story) => (
      <div
        className="flex items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950"
        style={{
          width: 350,
          aspectRatio: `1 / ${(1 - 2 * BOOK_TILE_PADDING_X) / (2 / 3) + 2 * BOOK_TILE_PADDING_Y}`,
          padding: `${BOOK_TILE_PADDING_Y * 100}% ${BOOK_TILE_PADDING_X * 100}%`,
        }}
      >
        <div className="aspect-[2/3] h-full w-full">
          <Story />
        </div>
      </div>
    ),
  ],
};
