import type { Meta, StoryObj } from "@storybook/react";
import { subDays, subHours } from "date-fns";
import type { InviteErrorContext } from "@/lib/invites";
import {
  InviteAlreadyUsedError,
  InviteExpiredError,
  InviteInvalidError,
} from "./invite-errors";

// Sample avatar URL (blue circle with letter)
const sampleAvatarUrl =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='40'%20height='40'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%230ea5e9'/%3E%3Ctext%20x='50%25'%20y='54%25'%20text-anchor='middle'%20font-size='20'%20font-family='system-ui'%20fill='white'%3EJ%3C/text%3E%3C/svg%3E";

// Mock invite contexts for different scenarios
const userInviteWithAvatar: InviteErrorContext = {
  email: "newuser@example.com",
  origin: "user",
  expiresAt: subDays(new Date(), 2), // Expired 2 days ago
  createdAt: subDays(new Date(), 9), // Created 9 days ago (7 day expiry)
  inviter: {
    username: "janedoe",
    avatarUrl: sampleAvatarUrl,
  },
};

const userInviteNoAvatar: InviteErrorContext = {
  email: "newuser@example.com",
  origin: "user",
  expiresAt: subHours(new Date(), 3), // Expired 3 hours ago
  createdAt: subDays(new Date(), 7),
  inviter: {
    username: "johndoe",
    avatarUrl: null,
  },
};

const waitlistInvite: InviteErrorContext = {
  email: "waitlisted@example.com",
  origin: "waitlist",
  expiresAt: subDays(new Date(), 1), // Expired 1 day ago
  createdAt: subDays(new Date(), 8),
  inviter: null,
};

const adminInvite: InviteErrorContext = {
  email: "vip@example.com",
  origin: "admin",
  expiresAt: subDays(new Date(), 5), // Expired 5 days ago
  createdAt: subDays(new Date(), 12),
  inviter: null,
};

// =============================================================================
// InviteExpiredError Stories
// =============================================================================

const expiredMeta = {
  title: "Auth/InviteExpiredError",
  component: InviteExpiredError,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof InviteExpiredError>;

export default expiredMeta;

type ExpiredStory = StoryObj<typeof expiredMeta>;

export const UserInviteWithAvatar: ExpiredStory = {
  name: "User Invite (with avatar)",
  args: {
    invite: userInviteWithAvatar,
  },
};

export const UserInviteNoAvatar: ExpiredStory = {
  name: "User Invite (no avatar)",
  args: {
    invite: userInviteNoAvatar,
  },
};

export const WaitlistInvite: ExpiredStory = {
  name: "Waitlist Invite",
  args: {
    invite: waitlistInvite,
  },
};

export const AdminInvite: ExpiredStory = {
  name: "Admin Invite",
  args: {
    invite: adminInvite,
  },
};

// =============================================================================
// InviteAlreadyUsedError Stories (separate file would be cleaner, but grouped here)
// =============================================================================

export const AlreadyUsedUserInvite: StoryObj<typeof InviteAlreadyUsedError> = {
  name: "Already Used - User Invite",
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

// =============================================================================
// All Variants Overview
// =============================================================================

export const AllVariants: StoryObj = {
  name: "All Variants",
  render: () => (
    <div className="flex flex-col gap-16 p-8">
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-500">
          Expired - User Invite (with avatar)
        </h2>
        <div className="rounded-lg border p-4">
          <InviteExpiredError invite={userInviteWithAvatar} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-500">
          Expired - Waitlist Invite
        </h2>
        <div className="rounded-lg border p-4">
          <InviteExpiredError invite={waitlistInvite} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-500">
          Expired - Admin Invite
        </h2>
        <div className="rounded-lg border p-4">
          <InviteExpiredError invite={adminInvite} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-500">
          Already Used - User Invite
        </h2>
        <div className="rounded-lg border p-4">
          <InviteAlreadyUsedError invite={userInviteWithAvatar} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-500">
          Already Used - Waitlist Invite
        </h2>
        <div className="rounded-lg border p-4">
          <InviteAlreadyUsedError invite={waitlistInvite} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-500">
          Invalid Invite
        </h2>
        <div className="rounded-lg border p-4">
          <InviteInvalidError />
        </div>
      </div>
    </div>
  ),
};
