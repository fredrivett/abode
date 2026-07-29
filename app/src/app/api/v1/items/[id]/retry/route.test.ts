import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUser,
  mockItemFindUnique,
  mockItemUpdate,
  mockTrigger,
  mockGuard,
  mockHasFullAdminAccess,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockItemFindUnique: vi.fn(),
  mockItemUpdate: vi.fn(),
  mockTrigger: vi.fn(),
  mockGuard: vi.fn(),
  mockHasFullAdminAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/admin/auth", () => ({
  hasFullAdminAccess: mockHasFullAdminAccess,
}));

vi.mock("@/lib/usage-limits", () => ({ guardDailyLimit: mockGuard }));

vi.mock("@/lib/db", () => ({
  default: {
    item: { findUnique: mockItemFindUnique, update: mockItemUpdate },
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

const failedUrlItem = {
  id: ITEM_ID,
  userId: "user_1",
  kind: "webpage" as const,
  processingStatus: "failed" as const,
  fileKey: null as string | null,
  sourceType: "url" as const,
  sourceUrl: "https://example.com/x",
};

const failedImageItem = {
  id: ITEM_ID,
  userId: "user_1",
  kind: "image" as const,
  processingStatus: "failed" as const,
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
    it("returns a 200 idempotent no-op for a completed item without re-running", async () => {
      mockItemFindUnique.mockResolvedValue({
        ...failedUrlItem,
        processingStatus: "completed",
      });
      const res = await call();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.processingStatus).toBe("completed");
      // Crucially: the daily reanalysis guard is NOT consumed and NOTHING is
      // triggered on the already-completed path (retry-loop must be free).
      expect(mockGuard).not.toHaveBeenCalled();
      expect(mockTrigger).not.toHaveBeenCalled();
      expect(mockItemUpdate).not.toHaveBeenCalled();
    });

    it("returns 400 for a still-processing item (pending/processing)", async () => {
      mockItemFindUnique.mockResolvedValue({
        ...failedUrlItem,
        processingStatus: "processing",
      });
      const res = await call();
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toBe("Item is still processing");
      expect(mockGuard).not.toHaveBeenCalled();
      expect(mockTrigger).not.toHaveBeenCalled();
    });

    it("re-triggers classify-url for a failed URL item (guard consumed, per-owner key)", async () => {
      const res = await call();
      expect(res.status).toBe(200);
      expect(mockGuard).toHaveBeenCalledWith("user_1", "reanalysis");
      expect(mockItemUpdate).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
        data: { processingStatus: "processing", processingError: null },
      });
      expect(mockTrigger).toHaveBeenCalledWith(
        "classify-url",
        { itemId: ITEM_ID, userId: "user_1", url: "https://example.com/x" },
        { concurrencyKey: "user_1" },
      );
    });

    it("re-triggers analyze-image for a failed image item (per-owner key)", async () => {
      mockItemFindUnique.mockResolvedValue(failedImageItem);
      const res = await call();
      expect(res.status).toBe(200);
      expect(mockTrigger).toHaveBeenCalledWith(
        "analyze-image",
        { itemId: ITEM_ID, userId: "user_1", fileKey: "user_1/photo.jpg" },
        { concurrencyKey: "user_1" },
      );
    });

    it("returns 400 when the item type can't be retried", async () => {
      mockItemFindUnique.mockResolvedValue({
        ...failedUrlItem,
        sourceType: "url",
        sourceUrl: null,
        kind: "webpage",
        fileKey: null,
      });
      const res = await call();
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toBe("Cannot retry this item type");
      expect(mockGuard).not.toHaveBeenCalled();
      expect(mockTrigger).not.toHaveBeenCalled();
    });

    it("returns 429 with Retry-After and does no paid work when over limit + enforced", async () => {
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
      // Status not flipped to processing when blocked.
      expect(mockItemUpdate).not.toHaveBeenCalled();
    });

    it("reverts to the prior status and returns 500 when the enqueue throws", async () => {
      mockTrigger.mockRejectedValue(new Error("no trigger key"));
      const res = await call();
      expect(res.status).toBe(500);
      expect(mockItemUpdate).toHaveBeenLastCalledWith({
        where: { id: ITEM_ID },
        data: { processingStatus: "failed" },
      });
    });
  });

  describe("admin", () => {
    it("may re-trigger a completed item, but still consumes the guard first", async () => {
      mockHasFullAdminAccess.mockResolvedValue(true);
      mockItemFindUnique.mockResolvedValue({
        ...failedUrlItem,
        userId: "owner_2", // admin retrying on behalf of another user
        processingStatus: "completed",
      });
      const res = await call();
      expect(res.status).toBe(200);
      expect(mockGuard).toHaveBeenCalledWith("user_1", "reanalysis");
      // Triggered with the OWNER's id as concurrencyKey, not the admin's.
      expect(mockTrigger).toHaveBeenCalledWith(
        "classify-url",
        { itemId: ITEM_ID, userId: "owner_2", url: "https://example.com/x" },
        { concurrencyKey: "owner_2" },
      );
    });

    it("reverts a completed item back to completed (not failed) on trigger error", async () => {
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
        data: { processingStatus: "completed" },
      });
    });
  });
});
