import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { NoteComposer } from "@/app/(app)/dashboard/note-composer";

const queryClient = new QueryClient();

const meta = {
  title: "Note/NoteComposer",
  component: NoteComposer,
  parameters: {
    layout: "padded",
  },
  // Composer uses React Query for cache invalidation on save
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="mx-auto max-w-2xl">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof NoteComposer>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Collapsed by default ("Take a note…"); click to expand into the editor.
 * Saving hits the API, which is a no-op in Storybook.
 */
export const Default: Story = {};
