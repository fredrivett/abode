import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "@/components/ui/input";

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  args: {
    placeholder: "Search library…",
  },
  argTypes: {
    type: {
      control: "text",
    },
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Password: Story = {
  args: {
    type: "password",
    placeholder: "Enter password",
  },
};

export const Invalid: Story = {
  args: {
    placeholder: "Invalid value",
    defaultValue: "Bad data",
    "aria-invalid": true,
  },
};
