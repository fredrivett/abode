import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockItemFind, mockItemUpdateMany, mockTrigger, mockGuard } =
  vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockItemFind: vi.fn(),
    mockItemUpdateMany: vi.fn(),
    mockTrigger: vi.fn(),
    mockGuard: vi.fn(),
  }));

vi.mock("@/lib/auth/authenticate-request", () => ({
  authenticateRequest: mockAuth,
}));
vi.mock("@/lib/usage-limits", () => ({ guardDailyLimit: mockGuard }));
vi.mock("@/lib/db", () => ({
  default: {
    item: { findUnique: mockItemFind, updateMany: mockItemUpdateMany },
  },
}));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: mockTrigger } }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
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

const ctx = { params: Promise.resolve({ id: ITEM_ID }) };

const validBody = {
  authorUsername: "oliverhamrin",
  caption: "hi",
  media: [
    { type: "photo", url: "https://cdn/a.jpg" },
    { type: "photo", url: "https://cdn/b.jpg" },
  ],
  coverMediaIndex: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user_1" }, method: "bearer" });
  mockGuard.mockResolvedValue({
    ok: true,
    check: { retryAfterSeconds: 3600 },
  });
  mockItemFind.mockResolvedValue({
    id: ITEM_ID,
    kind: "instagram",
    sourceUrl: "https://www.instagram.com/p/DbMJ/",
    instagramDetails: { postId: "DbMJ", mediaType: "post" },
  });
  // Claim succeeds by default (item was completed → now processing).
  mockItemUpdateMany.mockResolvedValue({ count: 1 });
  mockTrigger.mockResolvedValue({ id: "run_1" });
});

describe("POST /api/v1/items/[id]/instagram-enrich", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(request(validBody), ctx);
    expect(res.status).toBe(401);
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid payload (empty media)", async () => {
    const res = await POST(request({ ...validBody, media: [] }), ctx);
    expect(res.status).toBe(400);
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("returns 404 when the item is not found", async () => {
    mockItemFind.mockResolvedValue(null);
    const res = await POST(request(validBody), ctx);
    expect(res.status).toBe(404);
  });

  it("returns 400 when the item isn't an Instagram item", async () => {
    mockItemFind.mockResolvedValue({
      id: ITEM_ID,
      kind: "article",
      sourceUrl: "x",
      instagramDetails: null,
    });
    const res = await POST(request(validBody), ctx);
    expect(res.status).toBe(400);
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when over the daily limit", async () => {
    mockGuard.mockResolvedValue({
      ok: false,
      check: { retryAfterSeconds: 3600 },
    });
    const res = await POST(request(validBody), ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("returns 409 when an enrichment is already in flight (claim fails)", async () => {
    mockItemUpdateMany.mockResolvedValue({ count: 0 });
    const res = await POST(request(validBody), ctx);
    expect(res.status).toBe(409);
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it("enqueues the enrich task with the existing postId/mediaType + scraped media", async () => {
    const res = await POST(request(validBody), ctx);
    expect(res.status).toBe(200);
    expect(mockTrigger).toHaveBeenCalledOnce();
    const [taskId, payload] = mockTrigger.mock.calls[0];
    expect(taskId).toBe("enrich-instagram-item");
    expect(payload).toMatchObject({
      itemId: ITEM_ID,
      userId: "user_1",
      url: "https://www.instagram.com/p/DbMJ/",
      details: {
        postId: "DbMJ",
        mediaType: "post",
        authorUsername: "oliverhamrin",
      },
    });
    expect(payload.details.media).toHaveLength(2);
  });

  it("returns 500 when the enqueue throws", async () => {
    mockTrigger.mockRejectedValue(new Error("no trigger key"));
    const res = await POST(request(validBody), ctx);
    expect(res.status).toBe(500);
  });

  it("echoes CORS headers for an extension origin", async () => {
    const res = await POST(
      request(validBody, { origin: "chrome-extension://abcdef" }),
      ctx,
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "chrome-extension://abcdef",
    );
  });
});

describe("OPTIONS /api/v1/items/[id]/instagram-enrich", () => {
  it("answers the CORS preflight with 204", async () => {
    const res = OPTIONS(request({}, { origin: "chrome-extension://abc" }));
    expect(res.status).toBe(204);
  });
});
