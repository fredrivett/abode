import type { Meta, StoryObj } from "@storybook/react";

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

// Grid-tile size
export const GridTile: Story = {
  decorators: [
    (Story) => (
      <div className="aspect-[2/3] w-[150px]">
        <Story />
      </div>
    ),
  ],
};
