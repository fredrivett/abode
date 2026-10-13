import type { Meta, StoryObj } from "@storybook/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, screen, within } from "storybook/test";
import {
  type ShareInviteSettings,
  shareInviteSettingsQueryKey,
} from "@/lib/invites/use-share-invite-settings";
import { ShareHighlightDialog } from "./share-highlight-dialog";

// Seed the share-invite settings so the dialog never hits the network
function withSettings(settings: ShareInviteSettings) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  client.setQueryData(shareInviteSettingsQueryKey, settings);
  return client;
}

const meta = {
  title: "Article/ShareHighlightDialog",
  component: ShareHighlightDialog,
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: () => {},
    onShared: () => {},
    highlight: {
      id: "11111111-1111-4111-8111-111111111111",
      text: "Nobody notices any one of them. Everybody notices the sum.",
    },
    item: {
      id: "22222222-2222-4222-8222-222222222222",
      title: "How to make everything slightly better",
      domain: "example.com",
    },
    username: "fred",
    isShared: true,
  },
  decorators: [
    (Story, { parameters }) => (
      <QueryClientProvider
        client={withSettings(
          parameters.shareInvites ?? {
            allowShareInvites: true,
            availableInvites: 3,
          },
        )}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof ShareHighlightDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AlreadyShared: Story = {
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(
      dialog.getByText(/Readers can join abode with one of your invites/),
    ).toBeInTheDocument();
    await expect(dialog.getByText("Share highlight")).toBeInTheDocument();
    await expect(
      dialog.getByText(/Anyone with the link can see this highlight/),
    ).toBeInTheDocument();
  },
};

// Sharing will turn on link sharing for the article, so the dialog says so
export const NotYetShared: Story = {
  args: { isShared: false },
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(
      dialog.getByText(/Sharing turns on link sharing for this article/),
    ).toBeInTheDocument();
  },
};

// Readers can't join with the sharer's invites
export const ShareInvitesOff: Story = {
  parameters: {
    shareInvites: { allowShareInvites: false, availableInvites: 3 },
  },
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(
      dialog.getByText(/Readers can't join abode with your invites/),
    ).toBeInTheDocument();
  },
};

export const OutOfInvites: Story = {
  parameters: {
    shareInvites: { allowShareInvites: true, availableInvites: 0 },
  },
};
