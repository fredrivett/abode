import type { Meta, StoryObj } from "@storybook/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const sampleAvatarSrc =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='40'%20height='40'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%230ea5e9'/%3E%3Ctext%20x='50%25'%20y='54%25'%20text-anchor='middle'%20font-size='20'%20font-family='system-ui'%20fill='white'%3EA%3C/text%3E%3C/svg%3E";

const meta = {
  title: "UI/Avatar",
  component: Avatar,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FallbackOnly: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>FR</AvatarFallback>
    </Avatar>
  ),
};

export const WithImage: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src={sampleAvatarSrc} alt="Avatar" />
      <AvatarFallback>FR</AvatarFallback>
    </Avatar>
  ),
};

export const Large: Story = {
  render: () => (
    <Avatar className="size-16">
      <AvatarImage src={sampleAvatarSrc} alt="Avatar" />
      <AvatarFallback>FR</AvatarFallback>
    </Avatar>
  ),
};
