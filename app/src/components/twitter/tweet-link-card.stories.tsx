import type { Meta, StoryObj } from "@storybook/react";

import { storyArticleCard, storyLinkCard } from "./story-fixtures";
import { TweetLinkCard } from "./tweet-link-card";

const meta = {
  title: "Twitter/TweetLinkCard",
  component: TweetLinkCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { card: storyLinkCard },
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TweetLinkCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Link: Story = {};

export const LinkWithoutImage: Story = {
  args: { card: { ...storyLinkCard, imageUrl: null } },
};

/** An X Article: cover, title and the opening ~200 chars X shares */
export const Article: Story = {
  args: { card: storyArticleCard },
};

export const ArticleWithoutCover: Story = {
  args: { card: { ...storyArticleCard, imageUrl: null } },
};
