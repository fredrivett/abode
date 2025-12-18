import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

const meta = {
  title: "UI/Kbd",
  component: Kbd,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "primary"],
    },
  },
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "⌘",
  },
};

export const Primary: Story = {
  args: {
    variant: "primary",
    children: "⌘",
  },
  decorators: [
    (Story) => (
      <Button>
        Save
        <Story />
      </Button>
    ),
  ],
};

export const ArrowKeys: Story = {
  render: () => (
    <div className="flex gap-2">
      <Kbd>←</Kbd>
      <Kbd>↑</Kbd>
      <Kbd>↓</Kbd>
      <Kbd>→</Kbd>
    </div>
  ),
};

export const KeyboardShortcut: Story = {
  render: () => (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  ),
};

export const InButton: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Button variant="ghost-subtle">
        <Kbd>←</Kbd>
        Back
      </Button>
      <Button>
        Next
        <Kbd variant="primary">→</Kbd>
      </Button>
      <Button>
        Save
        <Kbd variant="primary">⌘</Kbd>
        <Kbd variant="primary">↵</Kbd>
      </Button>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Default:</span>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Primary (in button):
        </span>
        <Button>
          Action
          <Kbd variant="primary">⌘</Kbd>
          <Kbd variant="primary">↵</Kbd>
        </Button>
      </div>
    </div>
  ),
};
