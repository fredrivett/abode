import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, screen, within } from "storybook/test";
import { ShareHighlightDialog } from "./share-highlight-dialog";

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
} satisfies Meta<typeof ShareHighlightDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AlreadyShared: Story = {
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
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
