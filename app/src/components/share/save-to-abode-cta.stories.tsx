import type { Meta, StoryObj } from "@storybook/nextjs";
import { SaveToAbodeCta } from "./save-to-abode-cta";

// "Save to your abode" on shared item and highlight pages
const meta = {
  title: "Share/SaveToAbodeCta",
  component: SaveToAbodeCta,
  tags: ["autodocs"],
  args: {
    itemId: "22222222-2222-4222-8222-222222222222",
    sourceUrl: "https://example.com/slightly-better",
    ownerUsername: "fred",
    isSignedIn: false,
    invitesOpen: true,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SaveToAbodeCta>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Signed out, and the sharer has invites to give */
export const JoinWithInvite: Story = {};

/** Signed out, sharer out of invites or opted out */
export const Waitlist: Story = { args: { invitesOpen: false } };

/** Signed out, on an item without a link to save (e.g. an upload) */
export const NoLinkToSave: Story = { args: { sourceUrl: null } };

/** Signed in (not the owner): save straight to their library */
export const SignedIn: Story = { args: { isSignedIn: true } };
