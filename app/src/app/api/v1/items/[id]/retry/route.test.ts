import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ACTION_PRIORITY } from "@/lib/items/enqueue-user-processing";

const {
  mockGetUser,
  mockItemFindUnique,
  mockItemUpdate,
  mockItemUpdateMany,
  mockTrigger,
  mockGuard,
  mockHasFullAdminAccess,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockItemFindUnique: vi.fn(),
  mockItemUpdate: vi.fn(),
  mockItemUpdateMany: vi.fn(),
  mockTrigger: vi.fn(),
  mockGuard: vi.fn(),
  mockHasFullAdminAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
  // Route auth goes through getUserWithMfa; pass through to the mocked getUser
  getUserWithMfa: () => mockGetUser(),
}));

vi.mock("@/lib/admin/auth", () => ({
  hasFullAdminAccess: mockHasFullAdminAccess,
}));

vi.mock("@/lib/usage-limits", () => ({ guardDailyLimit: mockGuard }));

vi.mock("@/lib/db", () => ({
  default: {
    item: {
      findUnique: mockItemFindUnique,
      update: mockItemUpdate,
      updateMany: mockItemUpdateMany,
    },
  },
}));

vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: mockTrigger },
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

function call() {
  const request = {} as unknown as Parameters<typeof POST>[0];
  return POST(request, { params: Promise.resolve({ id: ITEM_ID }) });
}

// Fixed prior clock so revert can be asserted to restore it verbatim
const STARTED_AT = new Date("2026-01-01T00:00:00.000Z");

const failedUrlItem = {
  id: ITEM_ID,
  userId: "user_1",
  kind: "webpage" as const,
  processingStatus: "failed" as const,
  processingStartedAt: STARTED_AT,
  fileKey: null as string | null,
  sourceType: "url" as const,
  sourceUrl: "https://example.com/x",
};

const failedImageItem = {
  id: ITEM_ID,
  userId: "user_1",
  kind: "image" as const,
  processingStatus: "failed" as const,
  processingStartedAt: STARTED_AT,
  fileKey: "user_1/photo.jpg",
  sourceType: "upload" as const,
  sourceUrl: null as string | null,
};

const okGuard = {
  ok: true,
  action: "allow" as const,
  check: {
    allowed: true,
    count: 1,
    limit: 20,
    retryAfterSeconds: 3600,
    bucket: "reanalysis" as const,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user_1" } },
    error: null,
  });
  mockItemFindUnique.mockResolvedValue(failedUrlItem);
  mockItemUpdate.mockResolvedValue({});
  // The failed -> processing claim wins by default (one row updated).
  mockItemUpdateMany.mockResolvedValue({ count: 1 });
  mockTrigger.mockResolvedValue({ id: "run_1" });
  mockHasFullAdminAccess.mockResolvedValue(false);
  mockGuard.mockResolvedValue(okGuard);
});

describe("POST /api/v1/items/[id]/retry", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await call();
    expect(res.status).toBe(401);
    expect(mockItemFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the item doesn't exist", async () => {
    mockItemFindUnique.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(mockGuard).not.toHaveBeenCalled();
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  describe("non-admin", () => {
    it("returns a 200 no-op for a completed item without re-running", async () => {
      mockItemFindUnique.mockResolvedValue({
        ...failedUrlItem,
        processingStatus: "completed",
      });
      const res = await call();
      expect(res.status).toBe(200);
      expect((await res.json()).processingStatus).toBe("completed");
      expect(mockItemUpdateMany).not.toHaveBeenCalled();
      expect(mockGuard).not.toHaveBeenCalled();
      expect(mockTrigger).not.toHaveBeenCalled();
      expect(mockItemUpdate).not.toHaveBeenCalled();
    });

    it("returns 400 for a still-processing item", async () => {
      mockItemFindUnique.mockResolvedValue({
        ...failedUrlItem,
        processingStatus: "processing",
      });
      const res = await call();
      expect(res.status).toBe(400);
      expect((await res.json()).message).toBe("Item is still processing");
      expect(mockItemUpdateMany).not.toHaveBeenCalled();
      expect(mockGuard).not.toHaveBeenCalled();
    });

    it("returns 400 when the item type can't be retried", async () => {
      mockItemFindUnique.mockResolvedValue({
        ...failedUrlItem,
        sourceUrl: null,
        fileKey: null,
      });
      const res = await call();
      expect(res.status).toBe(400);
      expect((await res.json()).message).toBe("Cannot retry this item type");
      expect(mockItemUpdateMany).not.toHaveBeenCalled();
      expect(mockGuard).not.toHaveBeenCalled();
    });

    it("claims a failed URL item and re-triggers classify-url", async () => {
      const res = await call();
      expect(res.status).toBe(200);
      expect(mockItemUpdateMany).toHaveBeenCalledWith({
        where: { id: ITEM_ID, userId: "user_1", processingStatus: "failed" },
        data: {
          processingStatus: "processing",
          processingError: null,
          processingStartedAt: expect.any(Date),
        },
      });
      expect(mockGuard).toHaveBeenCalledWith("user_1", "reanalysis");
      expect(mockTrigger).toHaveBeenCalledWith(
        "classify-url",
        { itemId: ITEM_ID, userId: "user_1", url: "https://example.com/x" },
        { concurrencyKey: "user_1", priority: USER_ACTION_PRIORITY },
      );
      expect(mockItemUpdate).not.toHaveBeenCalled();
    });

    it("claims a failed image item and re-triggers analyze-image", async () => {
      mockItemFindUnique.mockResolvedValue(failedImageItem);
      const res = await call();
      expect(res.status).toBe(200);
      expect(mockTrigger).toHaveBeenCalledWith(
        "analyze-image",
        { itemId: ITEM_ID, userId: "user_1", fileKey: "user_1/photo.jpg" },
        { concurrencyKey: "user_1", priority: USER_ACTION_PRIORITY },
      );
    });

    it("returns a 200 no-op without triggering when it loses the claim race", async () => {
      mockItemUpdateMany.mockResolvedValue({ count: 0 });
      const res = await call();
      expect(res.status).toBe(200);
      expect((await res.json()).processingStatus).toBe("processing");
      expect(mockGuard).not.toHaveBeenCalled();
      expect(mockTrigger).not.toHaveBeenCalled();
      expect(mockItemUpdate).not.toHaveBeenCalled();
    });

    it("reverts the claim to failed and returns 429 when over limit (enforced)", async () => {
      mockGuard.mockResolvedValue({
        ok: false,
        action: "block",
        check: {
          allowed: false,
          count: 21,
          limit: 20,
          retryAfterSeconds: 3600,
          bucket: "reanalysis",
        },
      });
      const res = await call();
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("3600");
      expect(mockTrigger).not.toHaveBeenCalled();
      // Reverts status AND the reaper clock to their pre-claim values
      expect(mockItemUpdate).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
        data: { processingStatus: "failed", processingStartedAt: STARTED_AT },
      });
    });

    it("reverts to failed with enqueue_failed and returns 500 when the enqueue throws", async () => {
      mockTrigger.mockRejectedValue(new Error("no trigger key"));
      const res = await call();
      expect(res.status).toBe(500);
      // Reverting to failed stamps the reason so it doesn't render as "unknown"
      expect(mockItemUpdate).toHaveBeenLastCalledWith({
        where: { id: ITEM_ID },
        data: {
          processingStatus: "failed",
          processingStartedAt: STARTED_AT,
          processingError: "enqueue_failed",
        },
      });
    });
  });

  describe("admin", () => {
    it("re-triggers a completed item and consumes the guard, keyed by the owner", async () => {
      mockHasFullAdminAccess.mockResolvedValue(true);
      mockItemFindUnique.mockResolvedValue({
        ...failedUrlItem,
        userId: "owner_2",
        processingStatus: "completed",
      });
      const res = await call();
      expect(res.status).toBe(200);
      expect(mockItemUpdate).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
        data: {
          processingStatus: "processing",
          processingError: null,
          processingStartedAt: expect.any(Date),
        },
      });
      expect(mockItemUpdateMany).not.toHaveBeenCalled();
      expect(mockGuard).toHaveBeenCalledWith("user_1", "reanalysis");
      expect(mockTrigger).toHaveBeenCalledWith(
        "classify-url",
        { itemId: ITEM_ID, userId: "owner_2", url: "https://example.com/x" },
        { concurrencyKey: "owner_2", priority: USER_ACTION_PRIORITY },
      );
    });

    it("reverts a completed item back to completed on trigger error", async () => {
      mockHasFullAdminAccess.mockResolvedValue(true);
      mockItemFindUnique.mockResolvedValue({
        ...failedUrlItem,
        processingStatus: "completed",
      });
      mockTrigger.mockRejectedValue(new Error("no trigger key"));
      const res = await call();
      expect(res.status).toBe(500);
      expect(mockItemUpdate).toHaveBeenLastCalledWith({
        where: { id: ITEM_ID },
        data: {
          processingStatus: "completed",
          processingStartedAt: STARTED_AT,
        },
      });
    });
  });
});
