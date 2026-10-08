import type {
  QuotedTweet,
  TweetPoll,
  TweetReplyContext,
  TwitterDetails,
} from "./types";

/** Made-up tweets for the twitter component stories */

const avatar = (seed: string) => `https://picsum.photos/seed/${seed}/96/96`;

export const storyTweet: TwitterDetails = {
  tweetId: "1900000000000000001",
  authorName: "Jonah Pierce",
  authorUsername: "jonahpierce",
  authorAvatarUrl: avatar("jonah"),
  text: "Rebuilt the garden shed from salvaged timber this weekend. Proper footings this time.",
  isTruncated: false,
  postedAt: "2026-10-01T20:23:00.000Z",
  media: null,
  quotedTweetId: null,
  quotedTweet: null,
  card: null,
  poll: null,
  inReplyTo: null,
  coverMediaIndex: null,
};

export const storyLongFormTweet: TwitterDetails = {
  ...storyTweet,
  text: "Spent the weekend rebuilding the garden shed from salvaged timber. The old one had rotted through at the base, so the first job was a proper footing: gravel, slabs, then treated bearers. Walls went up quickly once the frame was square. The roof took longer than the rest of",
  isTruncated: true,
};

export const storyArticleCard: NonNullable<TwitterDetails["card"]> = {
  type: "article",
  title: "What a year of composting taught me",
  description:
    "Twelve months ago I started a compost heap with no idea what I was doing. Here is everything that went wrong, what finally worked, and the numbers behind it.",
  url: "https://x.com/i/article/1900000000000000099",
  imageUrl: "https://picsum.photos/seed/abode-article/1000/400",
};

export const storyLinkCard: NonNullable<TwitterDetails["card"]> = {
  title: "Choosing roofing felt for a garden shed",
  description: "A buyer's guide to shed felt, from budget rolls to torch-on.",
  url: "https://example.com/shed-felt",
  imageUrl: "https://picsum.photos/seed/abode-link-card/800/450",
};

export const storyArticleTweet: TwitterDetails = {
  ...storyTweet,
  authorName: "Nadia Builds",
  authorUsername: "nadiabuilds",
  authorAvatarUrl: avatar("nadia"),
  text: null,
  card: storyArticleCard,
};

export const storyQuote: QuotedTweet = {
  tweetId: "1900000000000000001",
  authorName: "Jonah Pierce",
  authorUsername: "jonahpierce",
  authorAvatarUrl: avatar("jonah"),
  text: storyLongFormTweet.text,
  isTruncated: true,
  postedAt: "2026-10-01T20:23:00.000Z",
  media: [
    {
      type: "photo",
      url: "https://picsum.photos/seed/abode-shed/800/450",
    },
  ],
};

export const storyPoll: TweetPoll = {
  options: [
    { label: "Felt", votes: 312 },
    { label: "Corrugated", votes: 488 },
    { label: "Living roof", votes: 97 },
  ],
  endsAt: "2026-10-03T11:20:32Z",
  isFinal: true,
};

export const storyReply: TweetReplyContext = {
  tweetId: "1900000000000000007",
  authorUsername: "nadiabuilds",
  authorName: "Nadia Builds",
  text: "What does everyone use under a shed? Slabs, gravel, or a timber base?",
};
