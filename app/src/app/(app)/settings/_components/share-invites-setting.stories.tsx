import type { Meta, StoryObj } from "@storybook/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, within } from "storybook/test";
import {
  type ShareInviteSettings,
  shareInviteSettingsQueryKey,
} from "@/lib/invites/use-share-invite-settings";
import { ShareInvitesSetting } from "./share-invites-setting";

// Seed the setting so the story never hits the network
function withSettings(settings: ShareInviteSettings) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  client.setQueryData(shareInviteSettingsQueryKey, settings);
  return client;
}

// Settings → Invites: let readers of shared links join with your invites
const meta = {
  title: "Settings/ShareInvitesSetting",
  component: ShareInvitesSetting,
  tags: ["autodocs"],
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
        <div style={{ maxWidth: 560 }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof ShareInvitesSetting>;

export default meta;
type Story = StoryObj<typeof meta>;

export const On: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("switch")).toBeChecked();
  },
};

export const Off: Story = {
  parameters: {
    shareInvites: { allowShareInvites: false, availableInvites: 3 },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("switch")).not.toBeChecked();
  },
};
