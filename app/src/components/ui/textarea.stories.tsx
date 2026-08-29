import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Textarea placeholder="Type your message here." />,
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="bio">Bio</Label>
      <Textarea id="bio" placeholder="Tell us a little about yourself" />
    </div>
  ),
};

export const WithValue: Story = {
  render: () => (
    <Textarea
      className="w-80"
      defaultValue="The quick brown fox jumps over the lazy dog."
    />
  ),
};

export const Disabled: Story = {
  render: () => (
    <Textarea className="w-80" disabled placeholder="Type your message here." />
  ),
};

export const Invalid: Story = {
  render: () => (
    <Textarea
      className="w-80"
      aria-invalid
      defaultValue="This value is invalid."
    />
  ),
};
