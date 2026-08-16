import type { Meta, StoryObj } from "@storybook/nextjs";
import { InvitedSection } from "./invited-section";

const referrals = [
  {
    id: "1",
    username: "jane",
    firstName: "Jane",
    lastName: "Doe",
    avatarUrl: null,
  },
  {
    id: "2",
    username: "sam",
    firstName: "Sam",
    lastName: null,
    avatarUrl: null,
  },
  {
    id: "3",
    username: "alex",
    firstName: null,
    lastName: null,
    avatarUrl: null,
  },
];

const meta = {
  title: "User/InvitedSection",
  component: InvitedSection,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InvitedSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    referrals,
  },
};

export const SinglePerson: Story = {
  args: {
    referrals: referrals.slice(0, 1),
  },
};

export const Empty: Story = {
  args: {
    referrals: [],
  },
};
