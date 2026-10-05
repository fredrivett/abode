import type { Meta, StoryObj } from "@storybook/nextjs";
import type { DataExportSnapshot } from "@/lib/export/snapshot";
import { ExportSettings } from "./export-settings";

const HOUR = 60 * 60 * 1000;
const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * HOUR).toISOString();

const ready: DataExportSnapshot = {
  id: "ready",
  status: "completed",
  itemCount: 1284,
  fileCount: 612,
  sizeBytes: 418_400_000,
  parts: [{ position: 1, sizeBytes: 418_400_000 }],
  error: null,
  createdAt: hoursFromNow(-2),
  completedAt: hoursFromNow(-2),
  expiresAt: hoursFromNow(24 * 7 - 2),
};

const meta = {
  title: "Settings/ExportSettings",
  component: ExportSettings,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: { initialExports: [], available: true },
} satisfies Meta<typeof ExportSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoExportsYet: Story = {};

export const Ready: Story = {
  args: { initialExports: [ready] },
};

export const SplitIntoParts: Story = {
  args: {
    initialExports: [
      {
        ...ready,
        fileCount: 4210,
        sizeBytes: 2_500_000_000,
        parts: [
          { position: 1, sizeBytes: 1_073_000_000 },
          { position: 2, sizeBytes: 1_073_000_000 },
          { position: 3, sizeBytes: 354_000_000 },
        ],
      },
    ],
  },
};

const inProgressExports: DataExportSnapshot[] = [
  {
    ...ready,
    id: "pending",
    status: "exporting",
    itemCount: null,
    fileCount: null,
    sizeBytes: null,
    parts: [],
    completedAt: null,
    expiresAt: null,
    createdAt: hoursFromNow(0),
  },
  ready,
];

export const InProgress: Story = {
  args: { initialExports: inProgressExports },
  // The page polls while an export builds; answer with the same state so the
  // story renders offline and stays in progress
  beforeEach: () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ exports: inProgressExports }), {
        headers: { "Content-Type": "application/json" },
      });
    return () => {
      globalThis.fetch = realFetch;
    };
  },
};

export const History: Story = {
  args: {
    initialExports: [
      ready,
      {
        ...ready,
        id: "failed",
        status: "failed",
        itemCount: null,
        fileCount: null,
        sizeBytes: null,
        parts: [],
        error: "The export couldn't be completed. Please try again.",
        createdAt: hoursFromNow(-30),
      },
      {
        ...ready,
        id: "expired",
        status: "expired",
        parts: [],
        createdAt: hoursFromNow(-24 * 9),
        expiresAt: hoursFromNow(-24 * 2),
      },
    ],
  },
};

export const Unavailable: Story = {
  args: { available: false },
};
