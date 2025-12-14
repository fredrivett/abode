import type { Meta, StoryObj } from "@storybook/react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  args: {
    children: "Save changes",
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "destructive-outline",
        "outline",
        "secondary",
        "ghost",
        "ghost-subtle",
        "link",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon", "icon-sm", "icon-lg"],
    },
    asChild: {
      control: false,
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Delete item",
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Secondary action",
  },
};

export const WithIcon: Story = {
  args: {
    size: "icon",
    variant: "secondary",
    children: <Plus className="size-4" />,
    "aria-label": "Add item",
  },
};

export const GhostSubtle: Story = {
  args: {
    variant: "ghost-subtle",
    children: "Open link",
  },
};

export const DestructiveOutline: Story = {
  args: {
    variant: "destructive-outline",
    children: "Delete item",
  },
};
