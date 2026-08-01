import type { Meta, StoryObj } from "@storybook/react";

import { BlurImage } from "./blur-image";

// A small solid-colour SVG standing in for a real tiny LQIP source.
const BLUR_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%233b82f6'/%3E%3C/svg%3E";

const meta = {
  title: "UI/BlurImage",
  component: BlurImage,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  // Needs a positioned, clipped parent — same requirement as BlurPlaceholder.
  decorators: [
    (Story) => (
      <div className="relative h-64 w-52 overflow-hidden rounded-lg bg-neutral-800">
        <Story />
      </div>
    ),
  ],
  args: {
    src: "https://picsum.photos/seed/blur-image/400/500",
    alt: "Example photo",
    blurDataUrl: BLUR_SRC,
    className: "h-full w-full object-cover",
  },
} satisfies Meta<typeof BlurImage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// No LQIP available — plain image, no blur-up.
export const NoBlur: Story = {
  args: { blurDataUrl: null },
};
