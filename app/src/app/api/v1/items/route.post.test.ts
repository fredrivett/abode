import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  guard: vi.fn(),
  itemCreate: vi.fn(),
  adjustCounters: vi.fn(),
  enqueue: vi.fn(),
  triggerConfigured: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: () => m.getUser(),
}));
vi.mock("@/lib/usage-limits", () => ({ guardDailyLimit: m.guard }));
vi.mock("@/lib/db", () => ({
  default: {
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({ item: { create: m.itemCreate } }),
  },
}));
vi.mock("@/lib/user-counters", () => ({
  adjustUserCounters: m.adjustCounters,
}));
vi.mock("@/lib/items/enqueue-image-analysis", () => ({
  enqueueImageAnalysis: m.enqueue,
}));
vi.mock("@/lib/trigger/item-runs", () => ({
  isTriggerConfigured: m.triggerConfigured,
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/milestones", () => ({ markMilestoneComplete: vi.fn() }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { POST } from "./route";

const USER = "user-1";
const FILE_KEY = `${USER}/abc.jpg`;

function call(payload: unknown) {
  const request = {
    json: async () => payload,
  } as unknown as Parameters<typeof POST>[0];
  return POST(request);
}

const imageBody = {
  kind: "image",
  fileKey: FILE_KEY,
  meta: { originalName: "beach_day.jpg", size: 1000, type: "image/jpeg" },
  sourceType: "upload",
};

beforeEach(() => {
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
  m.guard.mockResolvedValue({ ok: true });
  m.triggerConfigured.mockReturnValue(true);
  // Echo what was stored, as the route returns the created row
  m.itemCreate.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "item-1",
      ...data,
    }),
  );
});

describe("POST /api/v1/items (image upload)", () => {
  it("saves a processing image and enqueues analysis", async () => {
    const res = await call(imageBody);
    expect(res.status).toBe(201);
    const item = await res.json();
    expect(item.processingStatus).toBe("processing");
    // Analysis titles it
    expect(item.title).toBeUndefined();
    expect(m.enqueue).toHaveBeenCalledWith({
      itemId: "item-1",
      userId: USER,
      fileKey: FILE_KEY,
    });
  });

  it("saves a completed image titled from its file name, without enqueueing, when Trigger.dev isn't configured", async () => {
    m.triggerConfigured.mockReturnValue(false);
    const res = await call(imageBody);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      processingStatus: "completed",
      title: "beach day",
    });
    expect(m.enqueue).not.toHaveBeenCalled();
  });
});
