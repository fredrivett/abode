import type { Meta, StoryObj } from "@storybook/react";

import { ArticleCard } from "@/components/article/article-card";

const meta = {
  title: "Article/ArticleCard",
  component: ArticleCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
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
    publishedAt: "2026-01-15T00:00:00.000Z",
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

// Images in the body are stripped from the grid teaser (should read as text only)
export const BodyWithImages: Story = {
  args: {
    title: "Don't be a meat proxy",
    content: `The web is increasingly a place where you are a meat proxy.

![a large inline photo](https://example.com/photo.png)

Some thoughts on why that's a problem, ferrying intent from one system to another and rarely serving your own goals.`,
    domain: "gruhn.me",
    readingTime: 4,
  },
};

// No body: the title should drop to the bottom, by the footer (not strand at top)
export const NoContent: Story = {
  args: {
    title: "Don't be a meat proxy",
    content: null,
    domain: "gruhn.me",
    publishedAt: "2026-01-15T00:00:00.000Z",
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

// A tiny inline gradient stands in for a real cover image (deterministic, no network)
const COVER_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23475569'/%3E%3Cstop offset='1' stop-color='%230f172a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='500' fill='url(%23g)'/%3E%3C/svg%3E";

export const WithCover: Story = {
  args: {
    title: "Don't be a meat proxy",
    content: SAMPLE,
    domain: "gruhn.me",
    // Author leads the byline; domain is the fallback when it's absent
    author: "Rasmus Gruhn",
    publishedAt: "2026-01-15T00:00:00.000Z",
    readingTime: 4,
    coverUrl: COVER_SVG,
  },
};

export const WithCoverLongTitle: Story = {
  args: {
    title:
      "A very long article title that runs past a few lines and should clamp so the cover card stays tidy",
    content: SAMPLE,
    domain: "example.com",
    publishedAt: "2026-01-15T00:00:00.000Z",
    readingTime: 12,
    coverUrl: COVER_SVG,
  },
};
