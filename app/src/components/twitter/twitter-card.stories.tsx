import type { Meta, StoryObj } from "@storybook/react";

import { TwitterCard } from "./twitter-card";
import type { TwitterDetails } from "./types";

const noop = () => {};

const meta = {
  title: "Twitter/TwitterCard",
  component: TwitterCard,
  parameters: {
    layout: "centered",
  },
  args: {
    onClick: noop,
  },
  decorators: [
    (Story) => (
      <div className="h-[320px] w-[250px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TwitterCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// Sample tweet data for stories (based on real API responses)
const tweetWithVideo: TwitterDetails = {
  tweetId: "1585341984679469056",
  authorName: "Elon Musk",
  authorUsername: "elonmusk",
  authorAvatarUrl:
    "https://pbs.twimg.com/profile_images/1815749056821346304/jS8I28PL_normal.jpg",
  text: "Entering Twitter HQ – let that sink in!",
  postedAt: "2022-10-26T18:45:58.000Z",
  media: [
    {
      type: "video",
      url: "https://video.twimg.com/ext_tw_video/1585341912877146112/pu/vid/1280x720/cwj11yOgYZ05R_sY.mp4?tag=14",
      posterUrl:
        "https://pbs.twimg.com/ext_tw_video_thumb/1585341912877146112/pu/img/DwJ7wlGIe9iryk6N.jpg",
      width: 1920,
      height: 1080,
    },
  ],
  quotedTweetId: null,
  card: null,
};

const tweetWithPhoto: TwitterDetails = {
  tweetId: "896523232098078720",
  authorName: "Barack Obama",
  authorUsername: "BarackObama",
  authorAvatarUrl:
    "https://pbs.twimg.com/profile_images/1329647526807543809/2SGvnHYV_normal.jpg",
  text: '"No one is born hating another person because of the color of his skin or his background or his religion..."',
  postedAt: "2017-08-13T00:06:09.000Z",
  media: [
    {
      type: "photo",
      url: "https://pbs.twimg.com/media/DHEXH7RV0AAUwKj.jpg",
      width: 1200,
      height: 800,
    },
  ],
  quotedTweetId: null,
  card: null,
};

const tweetWithLinkCard: TwitterDetails = {
  tweetId: "1683920951807971329",
  authorName: "Vercel",
  authorUsername: "vercel",
  authorAvatarUrl:
    "https://pbs.twimg.com/profile_images/1767351110228918272/3Pndc5OT_normal.png",
  text: "Introducing `react-tweet`:\n\n◆ 35x less client-side JavaScript than the Twitter <iframe>\n◆ React Server Components for built-in data fetching\n◆ Works with Next.js, Vite, CRA, and more",
  postedAt: "2023-07-25T19:23:35.000Z",
  media: null,
  quotedTweetId: null,
  card: {
    title: "Introducing React Tweet - Vercel",
    description:
      "Embed tweets into your React application without sacrificing performance.",
    url: "https://vercel.com/blog/introducing-react-tweet",
    imageUrl:
      "https://pbs.twimg.com/card_img/2007572200522420226/8IgzTQ3M?format=png&name=800x419",
  },
};

const textOnlyTweet: TwitterDetails = {
  tweetId: "0000000000000000000",
  authorName: "Test User",
  authorUsername: "testuser",
  authorAvatarUrl: null,
  text: "This is a simple text-only tweet without any media or links. Just plain text content to test how it renders in the card and detail views.",
  postedAt: "2024-01-15T12:00:00.000Z",
  media: null,
  quotedTweetId: null,
  card: null,
};

export const WithVideo: Story = {
  args: {
    twitterDetails: tweetWithVideo,
  },
};

export const WithPhoto: Story = {
  args: {
    twitterDetails: tweetWithPhoto,
  },
};

export const WithLinkCard: Story = {
  args: {
    twitterDetails: tweetWithLinkCard,
  },
};

export const TextOnly: Story = {
  args: {
    twitterDetails: textOnlyTweet,
  },
  decorators: [
    (Story) => (
      <div className="h-[240px] w-[250px]">
        <Story />
      </div>
    ),
  ],
};

// Additional edge case variants
const longTextTweet: TwitterDetails = {
  tweetId: "long-text-example",
  authorName: "Verbose Writer",
  authorUsername: "verbosewriter",
  authorAvatarUrl:
    "https://pbs.twimg.com/profile_images/1329647526807543809/2SGvnHYV_normal.jpg",
  text: "This is an extremely long tweet that goes on and on to test how the text truncation works in our card component. We want to make sure that the line-clamp-3 class properly truncates the text after three lines and shows an ellipsis to indicate there is more content that isn't visible.",
  postedAt: "2024-01-20T10:30:00.000Z",
  media: null,
  quotedTweetId: null,
  card: null,
};

export const LongText: Story = {
  args: {
    twitterDetails: longTextTweet,
  },
  decorators: [
    (Story) => (
      <div className="h-[240px] w-[250px]">
        <Story />
      </div>
    ),
  ],
};

const noAvatarTweet: TwitterDetails = {
  tweetId: "no-avatar-example",
  authorName: "Anonymous User",
  authorUsername: "anonymous",
  authorAvatarUrl: null,
  text: "A tweet from a user without a profile picture, showing the default avatar placeholder.",
  postedAt: "2024-01-18T15:00:00.000Z",
  media: [
    {
      type: "photo",
      url: "https://pbs.twimg.com/media/DHEXH7RV0AAUwKj.jpg",
      width: 1200,
      height: 800,
    },
  ],
  quotedTweetId: null,
  card: null,
};

export const NoAvatar: Story = {
  args: {
    twitterDetails: noAvatarTweet,
  },
};

const usernameOnlyTweet: TwitterDetails = {
  tweetId: "username-only-example",
  authorName: null,
  authorUsername: "techuser42",
  authorAvatarUrl:
    "https://pbs.twimg.com/profile_images/1767351110228918272/3Pndc5OT_normal.png",
  text: "When a user has no display name set, we fall back to showing their username.",
  postedAt: "2024-01-19T08:00:00.000Z",
  media: null,
  quotedTweetId: null,
  card: null,
};

export const UsernameOnly: Story = {
  args: {
    twitterDetails: usernameOnlyTweet,
  },
  decorators: [
    (Story) => (
      <div className="h-[240px] w-[250px]">
        <Story />
      </div>
    ),
  ],
};

const linkCardNoImageTweet: TwitterDetails = {
  tweetId: "link-card-no-image",
  authorName: "Link Sharer",
  authorUsername: "linksharer",
  authorAvatarUrl:
    "https://pbs.twimg.com/profile_images/1815749056821346304/jS8I28PL_normal.jpg",
  text: "Check out this article about web development best practices!",
  postedAt: "2024-01-21T12:00:00.000Z",
  media: null,
  quotedTweetId: null,
  card: {
    title: "Web Development Best Practices",
    description: "A comprehensive guide to modern web development.",
    url: "https://example.com/article",
    imageUrl: null,
  },
};

export const LinkCardNoImage: Story = {
  args: {
    twitterDetails: linkCardNoImageTweet,
  },
  decorators: [
    (Story) => (
      <div className="h-[240px] w-[250px]">
        <Story />
      </div>
    ),
  ],
};

// Grid showcase of all variants
export const AllVariants: Story = {
  args: {
    twitterDetails: tweetWithVideo,
  },
  decorators: [
    () => (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="h-[320px] w-[250px]">
          <TwitterCard twitterDetails={tweetWithVideo} onClick={noop} />
        </div>
        <div className="h-[320px] w-[250px]">
          <TwitterCard twitterDetails={tweetWithPhoto} onClick={noop} />
        </div>
        <div className="h-[320px] w-[250px]">
          <TwitterCard twitterDetails={tweetWithLinkCard} onClick={noop} />
        </div>
        <div className="h-[240px] w-[250px]">
          <TwitterCard twitterDetails={textOnlyTweet} onClick={noop} />
        </div>
        <div className="h-[240px] w-[250px]">
          <TwitterCard twitterDetails={longTextTweet} onClick={noop} />
        </div>
        <div className="h-[320px] w-[250px]">
          <TwitterCard twitterDetails={noAvatarTweet} onClick={noop} />
        </div>
        <div className="h-[240px] w-[250px]">
          <TwitterCard twitterDetails={usernameOnlyTweet} onClick={noop} />
        </div>
        <div className="h-[240px] w-[250px]">
          <TwitterCard twitterDetails={linkCardNoImageTweet} onClick={noop} />
        </div>
      </div>
    ),
  ],
  parameters: {
    layout: "padded",
  },
};
