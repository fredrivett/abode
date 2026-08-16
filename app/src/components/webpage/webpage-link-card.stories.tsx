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

// Inline SVG data URI stands in for a re-hosted favicon so the story renders
// offline (in CI) without a network fetch
const SAMPLE_FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#635bff"/><path d="M15 10c-2 0-4 1-4 3s2 2.6 4 3.2c2 .6 4 1.2 4 3.8s-2 4-5 4-5-1.4-5-3" fill="none" stroke="#fff" stroke-width="2.4"/></svg>`,
  );

export const WithFavicon: Story = {
  args: {
    url: "https://stripe.com/blog/engineering",
    title: "The Stripe engineering blog",
    description: "Notes on building and scaling Stripe's systems.",
    faviconUrl: SAMPLE_FAVICON,
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
