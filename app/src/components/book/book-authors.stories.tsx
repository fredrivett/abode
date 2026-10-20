import type { Meta, StoryObj } from "@storybook/nextjs";
import { BookAuthors } from "./book-authors";

const meta = {
  title: "Book/BookAuthors",
  component: BookAuthors,
  tags: ["autodocs"],
  args: { authors: ["Walter Isaacson"], className: "text-muted-foreground" },
} satisfies Meta<typeof BookAuthors>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneAuthor: Story = {};

export const SeveralAuthors: Story = {
  args: { authors: ["Donella H. Meadows", "Diana Wright"] },
};
