import type { Meta, StoryObj } from "@storybook/react";

import { QuotedTweet } from "./quoted-tweet";
import { storyQuote } from "./story-fixtures";

const meta = {
  title: "Twitter/QuotedTweet",
  component: QuotedTweet,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { quote: storyQuote },
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QuotedTweet>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A long-form quote (cut off) with a photo */
export const LongFormWithPhoto: Story = {};

export const TextOnly: Story = {
  args: {
    quote: {
      ...storyQuote,
      text: "Proper footings this time.",
      isTruncated: false,
      media: null,
    },
  },
};

export const MultipleImages: Story = {
  args: {
    quote: {
      ...storyQuote,
      text: "Before and after.",
      isTruncated: false,
      media: [
        {
          type: "photo",
          url: "https://picsum.photos/seed/abode-before/800/450",
        },
        {
          type: "photo",
          url: "https://picsum.photos/seed/abode-after/800/450",
        },
      ],
    },
  },
};

export const NoDisplayName: Story = {
  args: {
    quote: { ...storyQuote, authorName: null, authorAvatarUrl: null },
  },
};
