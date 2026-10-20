import type { Meta, StoryObj } from "@storybook/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, screen, within } from "storybook/test";
import {
  type ShareInviteSettings,
  shareInviteSettingsQueryKey,
} from "@/lib/invites/use-share-invite-settings";
import {
  STORY_COVER_URL,
  STORY_NO_READING,
  STORY_REVIEW,
} from "./book-review-fixtures";
import { ShareBookReviewDialog } from "./share-book-review-dialog";

// Seed the share-invite settings so the dialog never hits the network
function withSettings(settings: ShareInviteSettings) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  client.setQueryData(shareInviteSettingsQueryKey, settings);
  return client;
}

const meta = {
  title: "Book/ShareBookReviewDialog",
  component: ShareBookReviewDialog,
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: () => {},
    onShared: () => {},
    book: {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Nineteen Eighty-Four",
      authors: ["George Orwell"],
      coverUrl: STORY_COVER_URL,
      coverRatio: 2 / 3,
      coverColor: "#7f1d1d",
    },
    review: STORY_REVIEW,
    username: "fred",
    isShared: true,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={withSettings({ allowShareInvites: true, availableInvites: 3 })}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof ShareBookReviewDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AlreadyShared: Story = {
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByText("Share review")).toBeInTheDocument();
    await expect(
      dialog.getByRole("button", { name: /Copy review/ }),
    ).toBeInTheDocument();
  },
};

export const NotYetShared: Story = {
  args: { isShared: false },
};

export const RatingOnly: Story = {
  args: { review: { ...STORY_REVIEW, review: null } },
};

// No rating or review yet: shares the book, and nudges for an opinion
export const BookOnly: Story = {
  args: { review: STORY_NO_READING },
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByText("Share book")).toBeInTheDocument();
  },
};
