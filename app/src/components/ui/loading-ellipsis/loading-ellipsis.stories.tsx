import type { Meta, StoryObj } from "@storybook/nextjs";
import { Loader2 } from "lucide-react";

import { LoadingEllipsis } from "./loading-ellipsis";

const meta: Meta<typeof LoadingEllipsis> = {
  title: "Components/Feedback/LoadingEllipsis",
  component: LoadingEllipsis,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof LoadingEllipsis>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center">
      <span>Loading</span>
      <LoadingEllipsis />
    </div>
  ),
};

export const WithSpinner: Story = {
  render: () => (
    <div className="text-muted-foreground">
      <p className="flex items-center gap-1.5">
        <Loader2 className="h-4 w-4 animate-spin opacity-60" />
        <span>
          Please wait while we process your request
          <LoadingEllipsis />
        </span>
      </p>
    </div>
  ),
};

export const Standalone: Story = {
  render: () => <LoadingEllipsis />,
};
