import type { Meta, StoryObj } from "@storybook/react";

import { storyPoll } from "./story-fixtures";
import { TweetPoll } from "./tweet-poll";

const meta = {
  title: "Twitter/TweetPoll",
  component: TweetPoll,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { poll: storyPoll },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TweetPoll>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Final: Story = {};

/** Counts are a snapshot from when the tweet was saved */
export const Open: Story = {
  args: { poll: { ...storyPoll, isFinal: false } },
};

export const NoVotes: Story = {
  args: {
    poll: {
      ...storyPoll,
      options: storyPoll.options.map((option) => ({ ...option, votes: 0 })),
    },
  },
};

export const TwoOptions: Story = {
  args: {
    poll: { ...storyPoll, options: storyPoll.options.slice(0, 2) },
  },
};
