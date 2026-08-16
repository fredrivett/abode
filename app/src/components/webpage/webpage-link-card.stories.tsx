import type { Meta, StoryObj } from "@storybook/nextjs";
import { WebpageLinkCard } from "./webpage-link-card";

const meta = {
  title: "Webpage/WebpageLinkCard",
  component: WebpageLinkCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[32rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WebpageLinkCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {
  args: {
    url: "https://www.fredrivett.com",
    title: "Hey there | @fredrivett",
    description:
      "I'm Fred and I like to make stuff. I also code, write and take photos.",
  },
};

export const TitleOnly: Story = {
  args: {
    url: "https://stripe.com/blog/engineering",
    title: "The Stripe engineering blog",
  },
};

export const DomainOnly: Story = {
  args: {
    url: "https://news.ycombinator.com/item?id=123456",
  },
};

// The card's primary home is the dark item-detail dialog — verify it there too
export const Dark: Story = {
  args: {
    url: "https://www.fredrivett.com",
    title: "Hey there | @fredrivett",
    description:
      "I'm Fred and I like to make stuff. I also code, write and take photos.",
  },
  decorators: [
    (Story) => (
      <div className="dark w-[32rem] bg-background p-8">
        <Story />
      </div>
    ),
  ],
};

export const LongTitleAndDescription: Story = {
  args: {
    url: "https://www.nytimes.com/2026/01/01/some/very/long/path",
    title:
      "A remarkably long headline that keeps going well past what fits on a single line and needs clamping",
    description:
      "An equally long standfirst that describes the article in more detail than anyone strictly needs, so we can see how the clamp behaves across three lines of body copy.",
  },
};
