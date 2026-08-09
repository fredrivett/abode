import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the route handler. vi.hoisted ensures
// these are initialized before the hoisted vi.mock factories reference them.
const {
  mockAuth,
  mockItemCreate,
  mockItemUpdate,
  mockTrigger,
  mockCapture,
  mockMarkMilestoneComplete,
  mockGuard,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockItemCreate: vi.fn(),
  mockItemUpdate: vi.fn(),
  mockTrigger: vi.fn(),
  mockCapture: vi.fn(),
  mockMarkMilestoneComplete: vi.fn(),
  mockGuard: vi.fn(),
}));

vi.mock("@/lib/auth/authenticate-request", () => ({
  authenticateRequest: mockAuth,
}));

vi.mock("@/lib/usage-limits", () => ({ guardDailyLimit: mockGuard }));

vi.mock("@/lib/url", () => ({ getAppBaseUrl: () => "https://www.abode.fyi" }));

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

import { OPTIONS, POST } from "./route";

const ITEM_ID = "item_1";

function request(
  body: Record<string, unknown>,
  { authorization, origin }: { authorization?: string; origin?: string } = {},
) {
  return {
    json: async () => body,
    headers: {
      get: (key: string) => {
        const k = key.toLowerCase();
        if (k === "authorization") return authorization ?? null;
        if (k === "origin") return origin ?? null;
        return null;
      },
    },
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user_1" }, method: "cookie" });
  // Default: within the daily limit — proceed.
  mockGuard.mockResolvedValue({
    ok: true,
    action: "allow",
    check: {
      allowed: true,
      count: 1,
      limit: 150,
      retryAfterSeconds: 3600,
      bucket: "ingestion",
    },
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
    mockAuth.mockResolvedValue(null);
    const res = await POST(request({ url: "https://example.com/x" }));
    expect(res.status).toBe(401);
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-http(s) URL", async () => {
    const res = await POST(request({ url: "javascript:alert(1)" }));
    expect(res.status).toBe(400);
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After (via CORS) and creates nothing when over limit + enforced", async () => {
    mockGuard.mockResolvedValue({
      ok: false,
      action: "block",
      check: {
        allowed: false,
        count: 151,
        limit: 150,
        retryAfterSeconds: 3600,
        bucket: "ingestion",
      },
    });
    const res = await POST(request({ url: "https://example.com/x" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it("creates the item and returns 201 on the happy path", async () => {
    const res = await POST(request({ url: "https://example.com/x" }));
    expect(res.status).toBe(201);
    expect(mockTrigger).toHaveBeenCalledOnce();
    expect(mockTrigger.mock.calls[0][0]).toBe("classify-url");
    // No failure → item is never downgraded to "failed"
    expect(mockItemUpdate).not.toHaveBeenCalled();
  });

  it("enqueues the enrich task for an extension direct-save with scraped media", async () => {
    const res = await POST(
      request({
        url: "https://www.instagram.com/p/DbMJ/",
        source: "extension",
        instagram: {
          postId: "DbMJ",
          mediaType: "post",
          authorUsername: "oliverhamrin",
          media: [
            { type: "photo", url: "https://cdn/a.jpg" },
            { type: "photo", url: "https://cdn/b.jpg" },
          ],
        },
      }),
    );
    expect(res.status).toBe(201);
    const [taskId, payload] = mockTrigger.mock.calls[0];
    expect(taskId).toBe("enrich-instagram-item");
    expect(payload).toMatchObject({
      restoreStatusOnFailure: "failed",
      details: { postId: "DbMJ", mediaType: "post" },
    });
    expect(payload.details.media).toHaveLength(2);
  });

  it("returns 400 for an invalid instagram scrape payload", async () => {
    const res = await POST(
      request({
        url: "https://www.instagram.com/p/DbMJ/",
        instagram: { postId: "DbMJ", mediaType: "post", media: [] },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("saves via a bearer-authenticated request (the extension path)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_1" }, method: "bearer" });
    const res = await POST(
      request(
        { url: "https://example.com/x", source: "extension" },
        { authorization: "Bearer token-abc" },
      ),
    );
    expect(res.status).toBe(201);
    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({ source: "extension" }),
      }),
    );
  });

  it("still returns 201 and marks the item failed when the enqueue throws", async () => {
    mockTrigger.mockRejectedValue(new Error("no trigger key"));
    const res = await POST(request({ url: "https://example.com/x" }));
    // The save must not fail just because the background enqueue did
    expect(res.status).toBe(201);
    // Item is marked failed so the UI surfaces a Retry action
    expect(mockItemUpdate).toHaveBeenCalledWith({
      where: { id: ITEM_ID },
      data: { processingStatus: "failed", processingError: "enqueue_failed" },
    });
  });

  it("still returns 201 when the mark-failed update also throws", async () => {
    mockTrigger.mockRejectedValue(new Error("no trigger key"));
    mockItemUpdate.mockRejectedValue(new Error("db unavailable"));
    const res = await POST(request({ url: "https://example.com/x" }));
    // The item is already persisted — a best-effort mark-failed failure
    // must not turn a successful save into an error.
    expect(res.status).toBe(201);
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

  it("echoes CORS headers for an extension origin", async () => {
    const res = await POST(
      request(
        { url: "https://example.com/x" },
        { origin: "chrome-extension://abcdef" },
      ),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "chrome-extension://abcdef",
    );
  });
});

describe("OPTIONS /api/v1/items/from-url", () => {
  it("answers the CORS preflight with 204", async () => {
    const res = await OPTIONS(
      request({}, { origin: "chrome-extension://abc" }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "chrome-extension://abc",
    );
  });
});
