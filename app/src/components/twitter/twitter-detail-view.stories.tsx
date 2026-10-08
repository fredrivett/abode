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
