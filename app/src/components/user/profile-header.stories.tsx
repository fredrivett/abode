import type { Meta, StoryObj } from "@storybook/nextjs";
import { ProfileHeader } from "./profile-header";

const inviter = {
  username: "jane",
  firstName: "Jane",
  lastName: "Doe",
  avatarUrl: null,
};

const meta = {
  title: "User/ProfileHeader",
  component: ProfileHeader,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    username: "fr",
    firstName: "Fred",
    lastName: "Rivett",
    website: "https://fredrivett.com",
    bio: null,
    avatarUrl: null,
    createdAt: new Date(2025, 11, 15),
    memberNumber: 1,
    showInvitedBy: false,
    referredBy: null,
    showInvited: true,
    referralCount: 0,
  },
} satisfies Meta<typeof ProfileHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBio: Story = {
  args: {
    bio: "Building things on the web. Collector of curiosities and half-finished side projects.",
  },
};

export const WithInviter: Story = {
  args: {
    showInvitedBy: true,
    referredBy: inviter,
  },
};

export const WithInvitedCount: Story = {
  args: {
    showInvited: false,
    referralCount: 2,
  },
};

export const SingleInvited: Story = {
  args: {
    showInvited: false,
    referralCount: 1,
  },
};

export const Everything: Story = {
  args: {
    showInvitedBy: true,
    referredBy: inviter,
    showInvited: false,
    referralCount: 5,
  },
};

export const NoMemberNumber: Story = {
  args: {
    memberNumber: null,
  },
};

export const UsernameOnly: Story = {
  args: {
    firstName: null,
    lastName: null,
    website: null,
  },
};
