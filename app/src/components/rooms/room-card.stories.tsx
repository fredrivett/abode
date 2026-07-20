import type { Meta, StoryObj } from "@storybook/nextjs";
import type { Filter } from "@/lib/search/types";
import { RoomCard } from "./room-card";

const sampleFilters: Filter[] = [
  { id: "1", type: "location", value: "Brazil", negated: false },
  { id: "2", type: "type", value: "image", negated: false },
];

const meta = {
  title: "Rooms/RoomCard",
  component: RoomCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "radio",
      options: ["smart", "manual"],
      description: "'smart' shows the Dynamic indicator + filter preview",
    },
    showPublicBadge: {
      control: "boolean",
      description: "Shows a 'Public' badge (owner dashboard only)",
    },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoomCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Static: Story = {
  args: {
    href: "#",
    name: "Seahaven",
    emoji: "🏡",
    itemCount: 5,
    type: "manual",
  },
};

export const Dynamic: Story = {
  args: {
    href: "#",
    name: "Brazil April 2025",
    emoji: "🇧🇷",
    itemCount: 27,
    type: "smart",
    filters: sampleFilters,
  },
};

export const WithPublicBadge: Story = {
  args: {
    href: "#",
    name: "Big trip 2024",
    emoji: "🌍",
    itemCount: 71,
    type: "smart",
    showPublicBadge: true,
    filters: sampleFilters,
  },
};

export const SingleItem: Story = {
  args: {
    href: "#",
    name: "Bedroom panelling",
    emoji: "🖼️",
    itemCount: 1,
    type: "manual",
  },
};

export const NoEmoji: Story = {
  args: {
    href: "#",
    name: "Saved articles",
    emoji: null,
    itemCount: 16,
    type: "smart",
  },
};

export const Grid: Story = {
  args: {
    href: "#",
    name: "Big trip 2024",
    emoji: "🌍",
    itemCount: 71,
    type: "smart",
  },
  render: () => (
    <div className="grid w-[48rem] gap-4 sm:grid-cols-2">
      <RoomCard
        href="#"
        name="Big trip 2024"
        emoji="🌍"
        itemCount={71}
        type="smart"
      />
      <RoomCard
        href="#"
        name="Seahaven"
        emoji="🏡"
        itemCount={5}
        type="manual"
        showPublicBadge
      />
      <RoomCard
        href="#"
        name="Brazil April 2025"
        emoji="🇧🇷"
        itemCount={27}
        type="smart"
        filters={sampleFilters}
      />
      <RoomCard
        href="#"
        name="Saved articles"
        emoji="📰"
        itemCount={16}
        type="smart"
      />
    </div>
  ),
};
