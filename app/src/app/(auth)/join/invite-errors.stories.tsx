import type { Meta, StoryObj } from "@storybook/react";
import { subDays, subHours } from "date-fns";
import type { InviteErrorContext } from "@/lib/invites";
import {
  InviteAlreadyUsedError,
  InviteExpiredError,
  InviteInvalidError,
} from "./invite-errors";

const sampleAvatarUrl = "https://api.dicebear.com/7.x/thumbs/svg?seed=janedoe";

const userInviteWithAvatar: InviteErrorContext = {
  email: "newuser@example.com",
  origin: "user",
  expiresAt: subDays(new Date(), 2),
  createdAt: subDays(new Date(), 9),
  inviter: {
    username: "janedoe",
    avatarUrl: sampleAvatarUrl,
  },
};

const userInviteNoAvatar: InviteErrorContext = {
  email: "newuser@example.com",
  origin: "user",
  expiresAt: subHours(new Date(), 3),
  createdAt: subDays(new Date(), 7),
  inviter: {
    username: "johndoe",
    avatarUrl: null,
  },
};

const waitlistInvite: InviteErrorContext = {
  email: "waitlisted@example.com",
  origin: "waitlist",
  expiresAt: subDays(new Date(), 1),
  createdAt: subDays(new Date(), 8),
  inviter: null,
};

const adminInvite: InviteErrorContext = {
  email: "vip@example.com",
  origin: "admin",
  expiresAt: subDays(new Date(), 5),
  createdAt: subDays(new Date(), 12),
  inviter: null,
};

const meta = {
  title: "Auth/InviteErrors",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <div className="p-16">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

// =============================================================================
// InviteExpiredError Stories
// =============================================================================

export const ExpiredUserInviteWithAvatar: StoryObj<typeof InviteExpiredError> =
  {
    name: "Expired - User Invite (with avatar)",
    render: () => <InviteExpiredError invite={userInviteWithAvatar} />,
  };

export const ExpiredUserInviteNoAvatar: StoryObj<typeof InviteExpiredError> = {
  name: "Expired - User Invite (no avatar)",
  render: () => <InviteExpiredError invite={userInviteNoAvatar} />,
};

export const ExpiredWaitlistInvite: StoryObj<typeof InviteExpiredError> = {
  name: "Expired - Waitlist Invite",
  render: () => <InviteExpiredError invite={waitlistInvite} />,
};

export const ExpiredAdminInvite: StoryObj<typeof InviteExpiredError> = {
  name: "Expired - Admin Invite",
  render: () => <InviteExpiredError invite={adminInvite} />,
};

// =============================================================================
// InviteAlreadyUsedError Stories
// =============================================================================

export const AlreadyUsedUserInviteWithAvatar: StoryObj<
  typeof InviteAlreadyUsedError
> = {
  name: "Already Used - User Invite (with avatar)",
  render: () => <InviteAlreadyUsedError invite={userInviteWithAvatar} />,
};

export const AlreadyUsedUserInviteNoAvatar: StoryObj<
  typeof InviteAlreadyUsedError
> = {
  name: "Already Used - User Invite (no avatar)",
  render: () => <InviteAlreadyUsedError invite={userInviteNoAvatar} />,
};

export const AlreadyUsedWaitlistInvite: StoryObj<
  typeof InviteAlreadyUsedError
> = {
  name: "Already Used - Waitlist Invite",
  render: () => <InviteAlreadyUsedError invite={waitlistInvite} />,
};

// =============================================================================
// InviteInvalidError Stories
// =============================================================================

export const InvalidInvite: StoryObj<typeof InviteInvalidError> = {
  name: "Invalid Invite",
  render: () => <InviteInvalidError />,
};
