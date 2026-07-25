import type { Meta, StoryObj } from "@storybook/nextjs";
import type { CSSProperties } from "react";
import { ItemCardSkeleton } from "./item-card-skeleton";

const meta = {
  title: "Dashboard/ItemCardSkeleton",
  component: ItemCardSkeleton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div
        className="h-64 w-48"
        style={{ "--grid-border-radius": "12px" } as CSSProperties}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ItemCardSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
