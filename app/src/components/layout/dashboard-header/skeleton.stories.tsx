import type { Meta, StoryObj } from "@storybook/nextjs";
import { DashboardHeaderSkeleton } from "./skeleton";

const meta = {
  title: "Layout/DashboardHeaderSkeleton",
  component: DashboardHeaderSkeleton,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardHeaderSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
