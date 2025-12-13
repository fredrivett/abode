import type { Meta, StoryObj } from "@storybook/react";

import { DateTime } from "@/components/ui/date-time";

const meta = {
  title: "UI/DateTime",
  component: DateTime,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    date: {
      control: "date",
    },
  },
} satisfies Meta<typeof DateTime>;

export default meta;

type Story = StoryObj<typeof meta>;

export const JustNow: Story = {
  args: {
    date: new Date(),
  },
};

export const FiveMinutesAgo: Story = {
  args: {
    date: new Date(Date.now() - 5 * 60 * 1000),
  },
};

export const OneHourAgo: Story = {
  args: {
    date: new Date(Date.now() - 60 * 60 * 1000),
  },
};

export const Yesterday: Story = {
  args: {
    date: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
};

export const OneWeekAgo: Story = {
  args: {
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
};

export const OneMonthAgo: Story = {
  args: {
    date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
};

export const FromString: Story = {
  args: {
    date: "2024-01-15T10:30:00Z",
  },
};
