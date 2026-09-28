import type { Meta, StoryObj } from "@storybook/react";
import { BOOK_TILE_PADDING_X, BOOK_TILE_PADDING_Y } from "@/lib/book-cover";
import { BookCover3D } from "./book-cover-3d";
import { BookReadingStatusBadge } from "./book-reading-status-icon";

// The badge is absolutely positioned + em-sized, so stories frame it on the
// item-card book tile it sits on in the grid
const meta = {
  title: "Book/BookReadingStatusBadge",
  component: BookReadingStatusBadge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div
        className="relative flex items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950"
        style={{
          width: 240,
          aspectRatio: `1 / ${(1 - 2 * BOOK_TILE_PADDING_X) / (2 / 3) + 2 * BOOK_TILE_PADDING_Y}`,
          padding: `${BOOK_TILE_PADDING_Y * 100}% ${BOOK_TILE_PADDING_X * 100}%`,
        }}
      >
        <div className="aspect-[2/3] h-full w-full">
          <BookCover3D
            src="https://covers.openlibrary.org/b/isbn/9780141036144-L.jpg"
            alt="Nineteen Eighty-Four"
          />
        </div>
        <Story />
      </div>
    ),
  ],
  args: { status: "want_to_read" },
} satisfies Meta<typeof BookReadingStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WantToRead: Story = {};
export const Reading: Story = { args: { status: "reading" } };
export const Read: Story = { args: { status: "read" } };
export const DidNotFinish: Story = { args: { status: "dnf" } };
