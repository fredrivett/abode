import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ACTION_PRIORITY } from "@/lib/items/enqueue-user-processing";
import { itemTag, userTag } from "@/lib/items/run-tags";

const {
  mockGetUser,
  mockItemFindUnique,
  mockItemUpdate,
  mockItemUpdateMany,
  mockTrigger,
  mockLogActivity,
  mockGuard,
  mockHasFullAdminAccess,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockItemFindUnique: vi.fn(),
  mockItemUpdate: vi.fn(),
  mockItemUpdateMany: vi.fn(),
  mockTrigger: vi.fn(),
  mockLogActivity: vi.fn(),
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

vi.mock("@/lib/usage-limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/usage-limits")>();
  return { ...actual, guardDailyLimit: mockGuard };
});

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
  // The atomic claim succeeds by default (one row updated).
  mockItemUpdateMany.mockResolvedValue({ count: 1 });
  mockTrigger.mockResolvedValue({ id: "run_1" });
  mockHasFullAdminAccess.mockResolvedValue(false);
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

  it("claims and triggers a forced re-classification on the happy path", async () => {
    const res = await call({ kind: "article" });
    expect(res.status).toBe(200);

    expect(mockItemUpdateMany).toHaveBeenCalledTimes(1);
    const claim = mockItemUpdateMany.mock.calls[0][0];
    expect(claim.where.OR).toBeDefined(); // non-admin: gated per UTC day
    expect(claim.data).toMatchObject({ processingStatus: "processing" });

    expect(mockTrigger).toHaveBeenCalledWith(
      "classify-url",
      {
        itemId: ITEM_ID,
        userId: "user_1",
        url: "https://example.com/x",
        forcedKind: "article",
      },
      {
        concurrencyKey: "user_1",
        priority: USER_ACTION_PRIORITY,
        tags: [itemTag(ITEM_ID), userTag("user_1")],
      },
    );
    expect(mockItemUpdate).not.toHaveBeenCalled();
  });

  it("restores the claim and returns 500 when enqueue throws", async () => {
    mockTrigger.mockRejectedValue(new Error("no trigger key"));
    const res = await call({ kind: "article" });
    expect(res.status).toBe(500);
    expect(mockItemUpdate).toHaveBeenCalledWith({
      where: { id: ITEM_ID },
      data: { processingStatus: "completed", lastReassignedAt: null },
    });
  });

  it("counts a claimed reassign against the reanalysis bucket", async () => {
    await call({ kind: "article" });
    expect(mockGuard).toHaveBeenCalledWith("user_1", "reanalysis");
  });

  it("reverts the claim and returns 429 when over the per-user limit (enforced)", async () => {
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
    expect(mockTrigger).not.toHaveBeenCalled();
    expect(mockItemUpdate).toHaveBeenCalledWith({
      where: { id: ITEM_ID },
      data: { processingStatus: "completed", lastReassignedAt: null },
    });
  });

  it("never blocks in shadow mode even when the action is over limit", async () => {
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
    it("returns 429 without counting or triggering when the claim is already taken", async () => {
      mockItemUpdateMany.mockResolvedValue({ count: 0 });
      const res = await call({ kind: "article" });
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
      expect(mockGuard).not.toHaveBeenCalled();
      expect(mockTrigger).not.toHaveBeenCalled();
      expect(mockItemUpdate).not.toHaveBeenCalled();
    });

    it("claims without the per-day gate for admins", async () => {
      mockHasFullAdminAccess.mockResolvedValue(true);
      const res = await call({ kind: "article" });
      expect(res.status).toBe(200);
      const claim = mockItemUpdateMany.mock.calls[0][0];
      expect(claim.where.OR).toBeUndefined();
      expect(claim.where).toMatchObject({ id: ITEM_ID, userId: "user_1" });
    });
  });
});
