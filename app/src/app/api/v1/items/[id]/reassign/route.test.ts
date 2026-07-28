import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUser,
  mockItemFindUnique,
  mockItemUpdate,
  mockTrigger,
  mockLogActivity,
  mockGuard,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockItemFindUnique: vi.fn(),
  mockItemUpdate: vi.fn(),
  mockTrigger: vi.fn(),
  mockLogActivity: vi.fn(),
  mockGuard: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
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

    // Marks processing, then enqueues classify-url with the forced kind
    expect(mockItemUpdate).toHaveBeenCalledWith({
      where: { id: ITEM_ID },
      data: { processingStatus: "processing" },
    });
    expect(mockTrigger).toHaveBeenCalledWith("classify-url", {
      itemId: ITEM_ID,
      userId: "user_1",
      url: "https://example.com/x",
      forcedKind: "article",
    });
  });

  it("restores the prior status and returns 500 when the enqueue throws", async () => {
    mockTrigger.mockRejectedValue(new Error("no trigger key"));
    const res = await call({ kind: "article" });
    expect(res.status).toBe(500);
    // First update sets processing, second restores the original status
    expect(mockItemUpdate).toHaveBeenLastCalledWith({
      where: { id: ITEM_ID },
      data: { processingStatus: "completed" },
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
    // Blocked before touching the item or enqueuing the paid pipeline.
    expect(mockItemFindUnique).not.toHaveBeenCalled();
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
});
