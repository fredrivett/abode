import type { Meta, StoryObj } from "@storybook/nextjs";
import type { PersonalAccessTokenSummary } from "@/lib/personal-access-tokens";
import { TokenSettings } from "./token-settings";

const HOUR = 60 * 60 * 1000;

function token(
  over: Partial<PersonalAccessTokenSummary>,
): PersonalAccessTokenSummary {
  return {
    id: "t1",
    name: "Claude Desktop",
    tokenPrefix: "abode_pat_aaaaaa",
    scopes: ["read"],
    itemCount: 0,
    lastUsedAt: null,
    expiresAt: null,
    createdAt: new Date(Date.now() - 48 * HOUR).toISOString(),
    ...over,
  };
}

const meta = {
  title: "Settings/TokenSettings",
  component: TokenSettings,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TokenSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { initialTokens: [] },
};

/** One token per permission mix; only tokens that can save show a saved-item count */
export const WithTokens: Story = {
  args: {
    initialTokens: [
      token({
        id: "t1",
        name: "Claude Desktop",
        scopes: ["read"],
        lastUsedAt: new Date(Date.now() - 3 * HOUR).toISOString(),
      }),
      token({
        id: "t2",
        name: "iOS Shortcut",
        tokenPrefix: "abode_pat_bbbbbb",
        scopes: ["write"],
        itemCount: 12,
        lastUsedAt: new Date(Date.now() - 0.5 * HOUR).toISOString(),
        expiresAt: new Date(Date.now() + 80 * 24 * HOUR).toISOString(),
      }),
      token({
        id: "t3",
        name: "Backup script",
        tokenPrefix: "abode_pat_cccccc",
        scopes: ["read", "write"],
        itemCount: 1,
      }),
    ],
  },
};
