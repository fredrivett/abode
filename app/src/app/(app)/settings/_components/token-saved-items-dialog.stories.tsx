import type { Meta, StoryObj } from "@storybook/nextjs";
import type {
  TokenSavedItem,
  TokenSavedItemsPage,
} from "@/lib/personal-access-tokens";
import { TokenSavedItemsDialog } from "./token-saved-items-dialog";

const HOUR = 60 * 60 * 1000;

const savedItems: TokenSavedItem[] = [
  {
    id: "i1",
    title: "The case for boring technology",
    kind: "article",
    sourceUrl: "https://example.com/boring-technology",
    addedAt: new Date(Date.now() - 0.5 * HOUR).toISOString(),
  },
  {
    id: "i2",
    title: null,
    kind: null,
    sourceUrl: "https://example.com/still-processing",
    addedAt: new Date(Date.now() - 2 * HOUR).toISOString(),
  },
  {
    id: "i3",
    title: "Walnut side table",
    kind: "product",
    sourceUrl: "https://shop.example.com/walnut-side-table",
    addedAt: new Date(Date.now() - 30 * HOUR).toISOString(),
  },
  {
    id: "i4",
    title: "Groceries for Saturday",
    kind: "note",
    sourceUrl: null,
    addedAt: new Date(Date.now() - 80 * HOUR).toISOString(),
  },
];

// The dialog fetches its own pages; answer with a fixed page so the story
// renders offline
function withPage(page: TokenSavedItemsPage) {
  return () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify(page), {
        headers: { "Content-Type": "application/json" },
      });
    return () => {
      globalThis.fetch = realFetch;
    };
  };
}

const meta = {
  title: "Settings/TokenSavedItemsDialog",
  component: TokenSavedItemsDialog,
  tags: ["autodocs"],
  args: { onClose: () => {} },
} satisfies Meta<typeof TokenSavedItemsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithItems: Story = {
  args: { token: { id: "t1", name: "iOS Shortcut", itemCount: 4 } },
  beforeEach: withPage({ items: savedItems, nextCursor: null }),
};

/** More pages to load */
export const MorePages: Story = {
  args: { token: { id: "t1", name: "iOS Shortcut", itemCount: 40 } },
  beforeEach: withPage({ items: savedItems, nextCursor: "next" }),
};

/** The token's saves were all deleted since */
export const Empty: Story = {
  args: { token: { id: "t1", name: "Backup script", itemCount: 0 } },
  beforeEach: withPage({ items: [], nextCursor: null }),
};
