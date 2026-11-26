import type { Meta, StoryObj } from "@storybook/react";

import {
  storyArticleTweet,
  storyLinkCard,
  storyLongFormTweet,
  storyPoll,
  storyQuote,
  storyReply,
  storyTweet,
} from "./story-fixtures";
import { TwitterDetailView } from "./twitter-detail-view";

const meta = {
  title: "Twitter/TwitterDetailView",
  component: TwitterDetailView,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { itemId: "story-item", twitterDetails: storyTweet },
} satisfies Meta<typeof TwitterDetailView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** X only shares the first ~280 chars of a long-form post */
export const LongFormPost: Story = {
  args: { twitterDetails: storyLongFormTweet },
};

/** An X Article post: its text is only a link, so the Article card carries it */
export const Article: Story = {
  args: { twitterDetails: storyArticleTweet },
};

export const ArticleWithIntro: Story = {
  args: {
    twitterDetails: { ...storyArticleTweet, text: "Do the maths." },
  },
};

export const LinkCard: Story = {
  args: { twitterDetails: { ...storyTweet, card: storyLinkCard } },
};

export const QuoteTweet: Story = {
  args: {
    twitterDetails: {
      ...storyTweet,
      tweetId: "1900000000000000003",
      authorName: "Nadia Builds",
      authorUsername: "nadiabuilds",
      text: "The best write-up on sheds I've read, and I've read a few",
      quotedTweetId: storyQuote.tweetId,
      quotedTweet: storyQuote,
    },
  },
};

export const Poll: Story = {
  args: {
    twitterDetails: {
      ...storyTweet,
      text: "Shed roof: what are we going with?",
      poll: storyPoll,
    },
  },
};

export const OpenPoll: Story = {
  args: {
    twitterDetails: {
      ...storyTweet,
      text: "Shed roof: what are we going with?",
      poll: { ...storyPoll, isFinal: false },
    },
  },
};

export const Reply: Story = {
  args: { twitterDetails: { ...storyTweet, inReplyTo: storyReply } },
};

/** The author replying to themselves: part of their thread */
export const ThreadContinuation: Story = {
  args: {
    twitterDetails: {
      ...storyTweet,
      text: "Day two: the roof.",
      inReplyTo: {
        ...storyReply,
        authorUsername: storyTweet.authorUsername,
        authorName: storyTweet.authorName,
        text: storyTweet.text,
      },
    },
  },
};

/** The parent post is no longer served by X (e.g. deleted) */
export const ReplyToUnavailablePost: Story = {
  args: {
    twitterDetails: {
      ...storyTweet,
      inReplyTo: { ...storyReply, authorName: null, text: null },
    },
  },
};

const storyPhoto = (seed: string, width: number, height: number) => ({
  type: "photo" as const,
  url: `https://picsum.photos/seed/${seed}/${width}/${height}`,
  width,
  height,
});

/** Up to 4 media sit in a grid; the owner sees the cover ringed */
export const MediaGrid: Story = {
  args: {
    onCoverImageChange: async () => {},
    twitterDetails: {
      ...storyTweet,
      coverMediaIndex: 1,
      media: [1, 2, 3, 4].map((n) => storyPhoto(`abode-grid-${n}`, 800, 800)),
    },
  },
};

/** More than 4 media scroll sideways in a carousel that bleeds past the tweet */
export const MediaCarousel: Story = {
  args: {
    onCoverImageChange: async () => {},
    twitterDetails: {
      ...storyTweet,
      coverMediaIndex: 0,
      media: Array.from({ length: 12 }, (_, n) =>
        storyPhoto(`abode-carousel-${n}`, 800, n % 3 === 1 ? 600 : 1000),
      ),
    },
  },
};
