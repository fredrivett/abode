import type { Meta, StoryObj } from "@storybook/react";

import { InstagramCard } from "./instagram-card";
import type { InstagramDetails } from "./types";

const noop = () => {};

const meta = {
  title: "Instagram/InstagramCard",
  component: InstagramCard,
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
} satisfies Meta<typeof InstagramCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const base: InstagramDetails = {
  postId: "DbMJgxFiNTq",
  mediaType: "post",
  authorName: "Oliver Hamrin",
  authorUsername: "oliverhamrin",
  caption:
    "From the archive: The Year of the Horse, Jan 2026 — #posterdesign #graphicdesign",
  postedAt: "2026-07-24T00:00:00.000Z",
  media: null,
  likeCount: 66,
  commentCount: 0,
  coverMediaIndex: null,
};

export const WithImage: Story = {
  args: {
    instagramDetails: {
      ...base,
      media: [
        {
          type: "photo",
          url: "https://picsum.photos/seed/instagram/600/600",
          width: 600,
          height: 600,
        },
      ],
      coverMediaIndex: 0,
    },
  },
};

export const CaptionOnly: Story = {
  args: { instagramDetails: base },
};

export const Placeholder: Story = {
  args: { instagramDetails: { ...base, caption: null } },
};
