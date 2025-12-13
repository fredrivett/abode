import type { Meta, StoryObj } from "@storybook/nextjs";
import { RefreshCw } from "lucide-react";

import { IsLoading } from "@/components/ui/is-loading";

const meta: Meta<typeof IsLoading> = {
  title: "Components/Feedback/IsLoading",
  component: IsLoading,
  parameters: { layout: "centered" },
  argTypes: {
    label: { control: "text" },
    icon: { control: false },
  },
};

export default meta;

type Story = StoryObj<typeof IsLoading>;

export const Default: Story = {
  args: {
    label: "Loading",
  },
};

export const CustomSizes: Story = {
  args: {
    label: "Saving",
    iconClassName: "h-5 w-5",
  },
};

export const WithCustomClasses: Story = {
  args: {
    label: "Processing",
    className: "text-muted-foreground",
    labelClassName: "font-medium",
  },
};

export const WithCustomIcon: Story = {
  args: {
    label: "Syncing",
    icon: RefreshCw,
    iconClassName: "h-4 w-4",
  },
};
