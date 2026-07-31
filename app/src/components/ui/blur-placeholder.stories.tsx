import type { Meta, StoryObj } from "@storybook/react";

import { BlurPlaceholder } from "./blur-placeholder";

// A small solid-colour SVG standing in for a real tiny LQIP source.
const BLUR_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%233b82f6'/%3E%3C/svg%3E";

const meta = {
  title: "UI/BlurPlaceholder",
  component: BlurPlaceholder,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  // Needs a positioned, clipped parent — the overscan is clipped by overflow-hidden.
  decorators: [
    (Story) => (
      <div className="relative h-64 w-52 overflow-hidden rounded-lg bg-neutral-800">
        <Story />
      </div>
    ),
  ],
  args: { blurDataUrl: BLUR_SRC, visible: true },
} satisfies Meta<typeof BlurPlaceholder>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Visible: Story = {};

export const FadedOut: Story = {
  args: { visible: false },
};
