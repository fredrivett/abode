import type { Meta, StoryObj } from "@storybook/nextjs";
import { Bell, Handshake, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountBadge } from "./count-badge";

const meta = {
  title: "UI/CountBadge",
  component: CountBadge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    count: {
      control: { type: "number", min: 0, max: 999 },
      description: "The count to display in the badge",
    },
    "aria-label": {
      control: "text",
      description: "Accessible label for screen readers",
    },
  },
} satisfies Meta<typeof CountBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    count: 3,
  },
  decorators: [
    (Story) => (
      <div className="relative">
        <Button variant="ghost-subtle" size="icon" className="relative">
          <Bell size={18} />
          <Story />
        </Button>
      </div>
    ),
  ],
};

export const SingleDigit: Story = {
  args: {
    count: 5,
    "aria-label": "5 notifications",
  },
  decorators: [
    (Story) => (
      <div className="relative">
        <Button variant="ghost-subtle" size="icon" className="relative">
          <Bell size={18} />
          <Story />
        </Button>
      </div>
    ),
  ],
};

export const DoubleDigit: Story = {
  args: {
    count: 42,
  },
  decorators: [
    (Story) => (
      <div className="relative">
        <Button variant="ghost-subtle" size="icon" className="relative">
          <Bell size={18} />
          <Story />
        </Button>
      </div>
    ),
  ],
};

export const LargeNumber: Story = {
  args: {
    count: 999,
  },
  decorators: [
    (Story) => (
      <div className="relative">
        <Button variant="ghost-subtle" size="icon" className="relative">
          <Bell size={18} />
          <Story />
        </Button>
      </div>
    ),
  ],
};

export const OnInvitesIcon: Story = {
  args: {
    count: 3,
    "aria-label": "3 invites remaining",
  },
  decorators: [
    (Story) => (
      <div className="relative">
        <Button variant="ghost-subtle" size="icon" className="relative">
          <Handshake size={18} />
          <Story />
        </Button>
      </div>
    ),
  ],
};

export const OnChecklistIcon: Story = {
  args: {
    count: 7,
    "aria-label": "7 tasks remaining",
  },
  decorators: [
    (Story) => (
      <div className="relative">
        <Button variant="ghost-subtle" size="icon" className="relative">
          <ListTodo size={18} />
          <Story />
        </Button>
      </div>
    ),
  ],
};

export const MultipleIcons: Story = {
  args: {
    count: 0,
  },
  render: () => (
    <div className="flex gap-2">
      <div className="relative">
        <Button variant="ghost-subtle" size="icon" className="relative">
          <Bell size={18} />
          <CountBadge count={12} />
        </Button>
      </div>
      <div className="relative">
        <Button variant="ghost-subtle" size="icon" className="relative">
          <Handshake size={18} />
          <CountBadge count={3} />
        </Button>
      </div>
      <div className="relative">
        <Button variant="ghost-subtle" size="icon" className="relative">
          <ListTodo size={18} />
          <CountBadge count={5} />
        </Button>
      </div>
    </div>
  ),
};

export const ClickThrough: Story = {
  args: {
    count: 8,
  },
  decorators: [
    (Story) => (
      <div className="flex flex-col items-center gap-4">
        <p className="text-muted-foreground text-sm">
          Click the icon - the badge doesn't block clicks
        </p>
        <div className="relative">
          <Button
            variant="ghost-subtle"
            size="icon"
            className="relative"
            onClick={() =>
              alert("Button clicked! Badge has pointer-events-none")
            }
          >
            <Bell size={18} />
            <Story />
          </Button>
        </div>
      </div>
    ),
  ],
};
