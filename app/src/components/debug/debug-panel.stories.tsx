import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import type { TraceEvent } from "@/lib/debug/trace";
import { DebugPanel } from "./debug-panel";

// A dialog remount chain: search write drops ?item=, the list refetches, the
// dialog loses its item and exits, then re-enters once the fetch lands
const REMOUNT_CHAIN: TraceEvent[] = [
  {
    id: 1,
    t: 4210.2,
    channel: "dialog",
    event: "card:click",
    data: { itemId: "a1" },
  },
  {
    id: 2,
    t: 4211,
    channel: "url",
    event: "pushState",
    data: { from: "/dashboard", to: "/dashboard?item=a1", added: ["item"] },
  },
  {
    id: 3,
    t: 4230.5,
    channel: "dialog",
    event: "CentralItemDialog:change",
    data: {
      openItemId: "null → a1",
      source: "none → list",
      hasContent: "false → true",
    },
  },
  {
    id: 4,
    t: 4231,
    channel: "dialog",
    event: "ItemDialogFrame:mount",
    data: { open: true },
  },
  {
    id: 5,
    t: 5820,
    channel: "query",
    event: "invalidate",
    data: { queryKey: '["items"]' },
  },
  {
    id: 6,
    t: 5821,
    channel: "query",
    event: "fetch",
    data: { queryKey: '["items"]', observers: 1 },
  },
  {
    id: 7,
    t: 6102.3,
    channel: "query",
    event: "success",
    data: { queryKey: '["items"]', pages: 2, items: 49 },
  },
  {
    id: 8,
    t: 6110,
    channel: "dialog",
    event: "CentralItemDialog:change",
    data: {
      source: "list → none",
      hasContent: "true → false",
      needsFetch: "false → true",
    },
  },
  { id: 9, t: 6111, channel: "dialog", event: "ItemDialogFrame:unmount" },
  {
    id: 10,
    t: 6140,
    channel: "grid",
    event: "reflow",
    data: {
      settleMs: 410,
      mutations: 38,
      moved: 12,
      movedVisible: 7,
      maxDy: 184,
      added: 0,
      removed: 1,
    },
  },
  {
    id: 11,
    t: 6200,
    channel: "layout",
    event: "layout-shift",
    data: { score: 0.0412, nodes: ["grid-item:b7"] },
  },
  {
    id: 12,
    t: 6300,
    channel: "perf",
    event: "slow-frame",
    data: { duration: 142, blocking: 88 },
  },
  { id: 13, t: 7000, channel: "mark", event: "mark" },
];

const meta = {
  title: "Debug/DebugPanel",
  component: DebugPanel,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: {
    events: REMOUNT_CHAIN,
    paused: false,
    onTogglePause: fn(),
    onClear: fn(),
    onCopy: fn(),
    onMark: fn(),
    onDisable: fn(),
  },
  decorators: [
    (Story) => (
      <div className="relative h-[28rem] bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DebugPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Timeline: Story = {};

export const Paused: Story = {
  args: { paused: true },
};

export const Empty: Story = {
  args: { events: [] },
};

export const Minimised: Story = {
  args: { defaultExpanded: false },
};
