import type { Meta, StoryObj } from "@storybook/nextjs";

import { PostedDateFooter } from "@/components/ui/posted-date-footer";

const meta: Meta<typeof PostedDateFooter> = {
  title: "Components/UI/PostedDateFooter",
  component: PostedDateFooter,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof PostedDateFooter>;

export const WithDate: Story = {
  args: {
    postedAt: "2024-03-01T12:00:00Z",
    viewOnHref: "https://x.com/example/status/1",
    viewOnLabel: "X",
  },
};

export const WithoutDate: Story = {
  args: {
    postedAt: null,
    viewOnHref: "https://instagram.com/p/abc",
    viewOnLabel: "Instagram",
  },
};
