import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_DOCUMENT_PAGES } from "@/lib/documents/create-document-schema";

const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  guard: vi.fn(),
  itemCreate: vi.fn(),
  pagesCreateMany: vi.fn(),
  userUpdate: vi.fn(),
  enqueue: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: () => m.getUser(),
}));
vi.mock("@/lib/usage-limits", () => ({ guardDailyLimit: m.guard }));
vi.mock("@/lib/items/enqueue-document-analysis", () => ({
  enqueueDocumentAnalysis: m.enqueue,
}));
vi.mock("@/lib/activity", () => ({ logActivity: m.logActivity }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/db", () => ({
  default: {
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        item: { create: m.itemCreate },
        itemDocumentPage: { createMany: m.pagesCreateMany },
        user: { update: m.userUpdate },
      }),
  },
}));

import { POST } from "./route";

const USER = "user-1";

const page = (n: number, filter: "bw" | "grey" | "original" = "bw") => ({
  fileKey: `${USER}/scan-${n}.jpg`,
  originalFileKey:
    filter === "original" ? `${USER}/scan-${n}.jpg` : `${USER}/scan-${n}-c.jpg`,
  filter,
  width: 1700,
  height: 2400,
  size: 400_000,
});

function call(body: unknown) {
  const request = {
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
  return POST(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
  m.guard.mockResolvedValue({ ok: true });
  m.itemCreate.mockResolvedValue({
    id: "item-1",
    kind: "document",
    processingStatus: "processing",
  });
});

describe("POST /api/v1/items/documents", () => {
  it("rejects unauthenticated requests", async () => {
    m.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await call({ pages: [page(1)] })).status).toBe(401);
  });

  it.each([
    ["no pages", { pages: [] }],
    [
      "too many pages",
      {
        pages: Array.from({ length: MAX_DOCUMENT_PAGES + 1 }, (_, i) =>
          page(i),
        ),
      },
    ],
    ["an unknown filter", { pages: [{ ...page(1), filter: "sepia" }] }],
    ["a non-positive size", { pages: [{ ...page(1), width: 0 }] }],
    ["a malformed body", null],
  ])("rejects %s without counting it", async (_label, body) => {
    const res = await call(body);
    expect(res.status).toBe(400);
    expect(m.guard).not.toHaveBeenCalled();
    expect(m.itemCreate).not.toHaveBeenCalled();
  });

  it("rejects files outside the user's folder", async () => {
    const res = await call({
      pages: [{ ...page(1), originalFileKey: "someone-else/x.jpg" }],
    });
    expect(res.status).toBe(400);
    expect(m.itemCreate).not.toHaveBeenCalled();
  });

  it("counts one ingestion action per page", async () => {
    await call({ pages: [page(1), page(2), page(3)] });
    expect(m.guard).toHaveBeenCalledWith(USER, "ingestion", { weight: 3 });
  });

  it("returns 429 without saving when over the daily limit", async () => {
    m.guard.mockResolvedValue({
      ok: false,
      check: { retryAfterSeconds: 60 },
    });
    const res = await call({ pages: [page(1)] });
    expect(res.status).toBe(429);
    expect(m.itemCreate).not.toHaveBeenCalled();
  });

  it("creates the document with page 1 as its file, and its pages in order", async () => {
    const res = await call({
      pages: [page(1), page(2, "original")],
      blurDataUrl: "data:image/png;base64,xyz",
    });
    expect(res.status).toBe(201);
    expect(m.itemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "document",
          fileKey: `${USER}/scan-1.jpg`,
          sourceType: "upload",
          processingStatus: "processing",
          meta: {
            type: "image/jpeg",
            width: 1700,
            height: 2400,
            size: 800_000,
            pageCount: 2,
            blurDataUrl: "data:image/png;base64,xyz",
          },
        }),
      }),
    );
    const [{ data: rows }] = m.pagesCreateMany.mock.calls[0];
    expect(rows.map((row: { position: number }) => row.position)).toEqual([
      0, 1,
    ]);
    expect(rows[1]).toMatchObject({
      itemId: "item-1",
      filter: "original",
      originalFileKey: `${USER}/scan-2.jpg`,
    });
  });

  it("tracks the uploaded bytes and item count", async () => {
    await call({ pages: [page(1), page(2)] });
    expect(m.userUpdate).toHaveBeenCalledWith({
      where: { id: USER },
      data: {
        itemCount: { increment: 1 },
        storageUsedBytes: { increment: 800_000 },
      },
    });
  });

  it("enqueues analysis for the saved document", async () => {
    await call({ pages: [page(1)] });
    expect(m.enqueue).toHaveBeenCalledWith({ itemId: "item-1", userId: USER });
  });
});
