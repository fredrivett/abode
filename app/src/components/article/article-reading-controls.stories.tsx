import type { Meta, StoryObj } from "@storybook/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArticleReadingControls } from "./article-reading-controls";

const queryClient = new QueryClient();

const meta = {
  title: "Article/ArticleReadingControls",
  component: ArticleReadingControls,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  // Persists via React Query invalidation on save (a no-op in Storybook)
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="w-72">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: { itemId: "00000000-0000-0000-0000-000000000000" },
} satisfies Meta<typeof ArticleReadingControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unread: Story = {
  args: { readAt: null },
};

export const Read: Story = {
  args: { readAt: "2026-09-01T09:00:00.000Z" },
};
