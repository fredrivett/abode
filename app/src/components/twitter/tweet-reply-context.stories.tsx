import type { Meta, StoryObj } from "@storybook/react";

import { storyReply } from "./story-fixtures";
import { TweetReplyContext } from "./tweet-reply-context";

const meta = {
  title: "Twitter/TweetReplyContext",
  component: TweetReplyContext,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { inReplyTo: storyReply, authorUsername: "jonahpierce" },
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TweetReplyContext>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Reply: Story = {};

/** The author replying to themselves */
export const ThreadContinuation: Story = {
  args: { authorUsername: storyReply.authorUsername },
};

/** X no longer serves the parent post */
export const ParentUnavailable: Story = {
  args: { inReplyTo: { ...storyReply, authorName: null, text: null } },
};
