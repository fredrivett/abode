import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUser,
  mockItemFindUnique,
  mockItemUpdate,
  mockTrigger,
  mockLogActivity,
  mockGuard,
  mockHasFullAdminAccess,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockItemFindUnique: vi.fn(),
  mockItemUpdate: vi.fn(),
  mockTrigger: vi.fn(),
  mockLogActivity: vi.fn(),
  mockGuard: vi.fn(),
  mockHasFullAdminAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/admin/auth", () => ({
  hasFullAdminAccess: mockHasFullAdminAccess,
}));

vi.mock("@/lib/usage-limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/usage-limits")>();
  return { ...actual, guardDailyLimit: mockGuard };
});

vi.mock("@/lib/db", () => ({
  default: {
    item: { findUnique: mockItemFindUnique, update: mockItemUpdate },
  },
}));

vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: mockTrigger },
}));

vi.mock("@/lib/activity", () => ({ logActivity: mockLogActivity }));

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

function call(body: Record<string, unknown>) {
  const request = { json: async () => body } as unknown as Parameters<
    typeof POST
  >[0];
  return POST(request, { params: Promise.resolve({ id: ITEM_ID }) });
}

const webpageItem = {
  id: ITEM_ID,
  userId: "user_1",
  kind: "webpage" as const,
  processingStatus: "completed" as const,
  sourceType: "url" as const,
  sourceUrl: "https://example.com/x",
  lastReassignedAt: null as Date | null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user_1" } },
    error: null,
  });
  mockItemFindUnique.mockResolvedValue(webpageItem);
  mockItemUpdate.mockResolvedValue({});
  mockTrigger.mockResolvedValue({ id: "run_1" });
  mockHasFullAdminAccess.mockResolvedValue(false);
  // Default: within the daily limit — proceed.
  mockGuard.mockResolvedValue({
    ok: true,
    action: "allow",
    check: {
      allowed: true,
      count: 1,
      limit: 20,
      retryAfterSeconds: 3600,
      bucket: "reanalysis",
    },
  });
});

describe("POST /api/v1/items/[id]/reassign", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await call({ kind: "article" });
    expect(res.status).toBe(401);
    expect(mockItemFindUnique).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-forcible kind", async () => {
    const res = await call({ kind: "twitter" });
    expect(res.status).toBe(400);
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown kind value", async () => {
    const res = await call({ kind: "banana" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the item doesn't exist", async () => {
    mockItemFindUnique.mockResolvedValue(null);
    const res = await call({ kind: "article" });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-URL item", async () => {
    mockItemFindUnique.mockResolvedValue({
      ...webpageItem,
      kind: "note",
      sourceType: "compose",
      sourceUrl: null,
    });
    const res = await call({ kind: "article" });
    expect(res.status).toBe(400);
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("returns 400 for a disallowed transition (no-op same kind)", async () => {
    const res = await call({ kind: "webpage" });
    expect(res.status).toBe(400);
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("returns 400 when the current kind is source-locked", async () => {
    mockItemFindUnique.mockResolvedValue({ ...webpageItem, kind: "video" });
    const res = await call({ kind: "article" });
    expect(res.status).toBe(400);
  });

  it("triggers a forced re-classification on the happy path", async () => {
    const res = await call({ kind: "article" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.processingStatus).toBe("processing");

    expect(mockItemUpdate).toHaveBeenCalledWith({
      where: { id: ITEM_ID },
      data: {
        processingStatus: "processing",
        lastReassignedAt: expect.any(Date),
      },
    });
    expect(mockTrigger).toHaveBeenCalledWith(
      "classify-url",
      {
        itemId: ITEM_ID,
        userId: "user_1",
        url: "https://example.com/x",
        forcedKind: "article",
      },
      { concurrencyKey: "user_1" },
    );
  });

  it("restores the prior status and cap timestamp, returns 500 when enqueue throws", async () => {
    mockTrigger.mockRejectedValue(new Error("no trigger key"));
    const res = await call({ kind: "article" });
    expect(res.status).toBe(500);
    expect(mockItemUpdate).toHaveBeenLastCalledWith({
      where: { id: ITEM_ID },
      data: { processingStatus: "completed", lastReassignedAt: null },
    });
  });

  it("counts every reassign attempt against the reanalysis bucket", async () => {
    await call({ kind: "article" });
    expect(mockGuard).toHaveBeenCalledWith("user_1", "reanalysis");
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
    const res = await call({ kind: "article" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
    expect(mockItemUpdate).not.toHaveBeenCalled();
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("never blocks in shadow mode even when the action is over limit", async () => {
    // Shadow mode: over limit (allowed:false) but guard returns ok:true.
    mockGuard.mockResolvedValue({
      ok: true,
      action: "shadow",
      check: {
        allowed: false,
        count: 21,
        limit: 20,
        retryAfterSeconds: 3600,
        bucket: "reanalysis",
      },
    });
    const res = await call({ kind: "article" });
    expect(res.status).toBe(200);
    expect(mockTrigger).toHaveBeenCalledOnce();
  });

  describe("per-item once-per-UTC-day cap", () => {
    it("rejects a non-admin's second reassign the same UTC day (429) before the guard", async () => {
      mockItemFindUnique.mockResolvedValue({
        ...webpageItem,
        lastReassignedAt: new Date(),
      });
      const res = await call({ kind: "article" });
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
      expect(mockGuard).not.toHaveBeenCalled();
      expect(mockItemUpdate).not.toHaveBeenCalled();
      expect(mockTrigger).not.toHaveBeenCalled();
    });

    it("allows a non-admin again once the reassign was on a previous UTC day", async () => {
      mockItemFindUnique.mockResolvedValue({
        ...webpageItem,
        lastReassignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      });
      const res = await call({ kind: "article" });
      expect(res.status).toBe(200);
      expect(mockTrigger).toHaveBeenCalledOnce();
    });

    it("exempts admins from the per-item cap (second same-day reassign allowed)", async () => {
      mockHasFullAdminAccess.mockResolvedValue(true);
      mockItemFindUnique.mockResolvedValue({
        ...webpageItem,
        lastReassignedAt: new Date(),
      });
      const res = await call({ kind: "article" });
      expect(res.status).toBe(200);
      expect(mockTrigger).toHaveBeenCalledOnce();
    });
  });
});
