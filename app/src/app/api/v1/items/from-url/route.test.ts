import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the route handler. vi.hoisted ensures
// these are initialized before the hoisted vi.mock factories reference them.
const {
  mockGetUser,
  mockItemCreate,
  mockItemUpdate,
  mockTrigger,
  mockCapture,
  mockMarkMilestoneComplete,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockItemCreate: vi.fn(),
  mockItemUpdate: vi.fn(),
  mockTrigger: vi.fn(),
  mockCapture: vi.fn(),
  mockMarkMilestoneComplete: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/db", () => ({
  default: { item: { create: mockItemCreate, update: mockItemUpdate } },
}));

vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: mockTrigger },
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: mockCapture }),
  captureServerException: vi.fn(),
}));

vi.mock("@/lib/milestones", () => ({
  markMilestoneComplete: mockMarkMilestoneComplete,
}));

vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { POST } from "./route";

const ITEM_ID = "item_1";

function request(body: Record<string, unknown>) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user_1" } },
    error: null,
  });
  mockItemCreate.mockResolvedValue({
    id: ITEM_ID,
    userId: "user_1",
    kind: null,
    processingStatus: "processing",
    sourceType: "url",
    sourceUrl: "https://example.com/x",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mockItemUpdate.mockResolvedValue({});
  mockTrigger.mockResolvedValue({ id: "run_1" });
});

describe("POST /api/v1/items/from-url", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(request({ url: "https://example.com/x" }));
    expect(res.status).toBe(401);
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-http(s) URL", async () => {
    const res = await POST(request({ url: "javascript:alert(1)" }));
    expect(res.status).toBe(400);
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it("creates the item and returns 201 on the happy path", async () => {
    const res = await POST(request({ url: "https://example.com/x" }));
    expect(res.status).toBe(201);
    expect(mockTrigger).toHaveBeenCalledOnce();
    // No failure → item is never downgraded to "failed"
    expect(mockItemUpdate).not.toHaveBeenCalled();
  });

  it("still returns 201 and marks the item failed when the enqueue throws", async () => {
    mockTrigger.mockRejectedValue(new Error("no trigger key"));
    const res = await POST(request({ url: "https://example.com/x" }));
    // The save must not fail just because the background enqueue did
    expect(res.status).toBe(201);
    // Item is marked failed so the UI surfaces a Retry action
    expect(mockItemUpdate).toHaveBeenCalledWith({
      where: { id: ITEM_ID },
      data: { processingStatus: "failed" },
    });
  });

  it("records the share_target source on the analytics event", async () => {
    await POST(
      request({ url: "https://example.com/x", source: "share_target" }),
    );
    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "item_imported_from_url",
        properties: expect.objectContaining({ source: "share_target" }),
      }),
    );
  });

  it("defaults the source to web for an unknown source value", async () => {
    await POST(request({ url: "https://example.com/x", source: "bogus" }));
    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({ source: "web" }),
      }),
    );
  });
});
