import type { Meta, StoryObj } from "@storybook/react";

import { ArticleCard } from "@/components/article/article-card";

const meta = {
  title: "Article/ArticleCard",
  component: ArticleCard,
  parameters: {
    layout: "centered",
  },
  // Coverless articles are text cards; render at a representative grid size
  decorators: [
    (Story) => (
      <div style={{ width: 260, height: 325 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArticleCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const SAMPLE = `The web is increasingly a place where you are a meat proxy — a body sat in front of a screen, ferrying intent from one system to another.

Some thoughts on why that's a problem:
- It optimises for engagement, not for you
- The incentives rarely point at your actual goals
- You end up serving the machine rather than the reverse

Reclaiming your attention starts with noticing when it happens.`;

export const FullArticle: Story = {
  args: {
    title: "Don't be a meat proxy",
    content: SAMPLE,
    domain: "gruhn.me",
    readingTime: 4,
  },
};

export const NoReadingTime: Story = {
  args: {
    title: "Don't be a meat proxy",
    content: SAMPLE,
    domain: "gruhn.me",
    readingTime: null,
  },
};

export const NoContent: Story = {
  args: {
    title: "Don't be a meat proxy",
    content: null,
    domain: "gruhn.me",
    readingTime: null,
  },
};

export const LongTitle: Story = {
  args: {
    title:
      "A very long article title that runs past two lines and should be clamped so the card stays tidy",
    content: SAMPLE,
    domain: "example.com",
    readingTime: 12,
  },
};
