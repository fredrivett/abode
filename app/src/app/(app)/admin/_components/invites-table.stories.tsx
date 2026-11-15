import type { Meta, StoryObj } from "@storybook/nextjs";
import { InvitesTable } from "./invites-table";

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

type InviteRow = Parameters<typeof InvitesTable>[0]["invites"][number];

const invite = (over: Partial<InviteRow>): InviteRow => ({
  id: "inv_1",
  email: "sam@example.com",
  origin: "user",
  status: "pending",
  expiresAt: daysFromNow(5),
  acceptedAt: null,
  sendCount: 1,
  createdAt: daysFromNow(-2),
  inviter: {
    id: "u_1",
    email: "alex@example.com",
    username: "alex",
    displayName: "Alex Example",
  },
  waitlistEntryId: null,
  referralSource: null,
  ...over,
});

const meta = {
  title: "Admin/InvitesTable",
  component: InvitesTable,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: {
    pagination: { page: 1, pageSize: 20, totalCount: 4, totalPages: 1 },
    search: "",
    statusFilter: "all",
    originFilter: "all",
  },
} satisfies Meta<typeof InvitesTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryStatus: Story = {
  args: {
    invites: [
      invite({ id: "inv_pending" }),
      invite({
        id: "inv_accepted",
        email: "jo@example.com",
        status: "accepted",
        acceptedAt: daysFromNow(-1),
      }),
      // The recipient joined through a sibling invite after this one expired
      invite({
        id: "inv_joined_elsewhere",
        email: "kim@example.com",
        status: "joined_elsewhere",
        expiresAt: daysFromNow(-3),
        acceptedAt: daysFromNow(-1),
        sendCount: 2,
        createdAt: daysFromNow(-10),
      }),
      invite({
        id: "inv_expired",
        email: "lee@example.com",
        status: "expired",
        expiresAt: daysFromNow(-3),
        createdAt: daysFromNow(-10),
      }),
    ],
  },
};

export const Empty: Story = {
  args: {
    invites: [],
    pagination: { page: 1, pageSize: 20, totalCount: 0, totalPages: 0 },
  },
};
