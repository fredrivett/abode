import type { Meta, StoryObj } from "@storybook/nextjs";
import { type ItemRunRow, ItemRunsCard } from "./item-runs-card";

const row = (over: Partial<ItemRunRow> = {}): ItemRunRow => ({
  id: "run_abc123",
  status: "COMPLETED",
  taskIdentifier: "analyze-image",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  startedAt: new Date("2026-01-01T12:00:01Z"),
  finishedAt: new Date("2026-01-01T12:00:04Z"),
  durationMs: 3200,
  costInCents: 2,
  href: "https://dash.example/runs/run_abc123",
  ...over,
});

const meta = {
  title: "Admin/ItemRunsCard",
  component: ItemRunsCard,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof ItemRunsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRuns: Story = {
  args: {
    result: {
      state: "ok",
      runs: [
        row({ id: "run_1", taskIdentifier: "classify-url" }),
        row({
          id: "run_2",
          taskIdentifier: "analyze-image",
          status: "EXECUTING",
          durationMs: 0,
          costInCents: 0,
          finishedAt: null,
        }),
        row({
          id: "run_3",
          taskIdentifier: "enrich-item",
          status: "FAILED",
        }),
      ],
    },
  },
};

export const NoRunLink: Story = {
  args: {
    result: { state: "ok", runs: [row({ href: null })] },
  },
};

export const Empty: Story = {
  args: { result: { state: "ok", runs: [] } },
};

export const LoadError: Story = {
  args: { result: { state: "error" } },
};
