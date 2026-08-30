import type { Meta, StoryObj } from "@storybook/nextjs";

import { ViewOnButton } from "@/components/ui/view-on-button";

const meta: Meta<typeof ViewOnButton> = {
  title: "Components/UI/ViewOnButton",
  component: ViewOnButton,
  parameters: { layout: "centered" },
  argTypes: {
    href: { control: "text" },
    label: { control: "text" },
  },
};

export default meta;

type Story = StoryObj<typeof ViewOnButton>;

export const Platform: Story = {
  args: {
    href: "https://x.com/example/status/1",
    label: "X",
  },
};

export const Domain: Story = {
  args: {
    href: "https://example.com/product/1",
    label: "example.com",
  },
};
