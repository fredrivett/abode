import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PDF_UPLOAD_BYTES } from "@/lib/uploads";

const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  guard: vi.fn(),
  itemCreate: vi.fn(),
  userUpdate: vi.fn(),
  enqueue: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: () => m.getUser(),
}));
vi.mock("@/lib/usage-limits", () => ({ guardDailyLimit: m.guard }));
vi.mock("@/lib/items/enqueue-pdf-import", () => ({
  enqueuePdfImport: m.enqueue,
}));
vi.mock("@/lib/activity", () => ({ logActivity: m.logActivity }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/db", () => ({
  default: {
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({ item: { create: m.itemCreate }, user: { update: m.userUpdate } }),
  },
}));

import { POST } from "./route";

const USER = "user-1";
const body = (overrides: Record<string, unknown> = {}) => ({
  fileKey: `${USER}/abc.pdf`,
  originalName: "Energy_bill  March.pdf",
  size: 120_000,
  ...overrides,
});

function call(payload: unknown) {
  const request = {
    json: async () => payload,
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

describe("POST /api/v1/items/documents/pdf", () => {
  it("rejects unauthenticated requests", async () => {
    m.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await call(body())).status).toBe(401);
    expect(m.itemCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-PDF key", body({ fileKey: `${USER}/abc.png` })],
    ["a file over the size cap", body({ size: MAX_PDF_UPLOAD_BYTES + 1 })],
    ["an empty file", body({ size: 0 })],
    ["a missing name", body({ originalName: "" })],
    ["a malformed body", null],
  ])("rejects %s without counting it", async (_label, payload) => {
    expect((await call(payload)).status).toBe(400);
    expect(m.guard).not.toHaveBeenCalled();
    expect(m.itemCreate).not.toHaveBeenCalled();
  });

  it("rejects a file outside the user's folder", async () => {
    const res = await call(body({ fileKey: "someone-else/abc.pdf" }));
    expect(res.status).toBe(400);
    expect(m.itemCreate).not.toHaveBeenCalled();
  });

  it("returns 429 without saving when over the daily limit", async () => {
    m.guard.mockResolvedValue({ ok: false, check: { retryAfterSeconds: 60 } });
    const res = await call(body());
    expect(res.status).toBe(429);
    expect(m.itemCreate).not.toHaveBeenCalled();
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("creates a processing document holding the PDF as its source file", async () => {
    const res = await call(body());
    expect(res.status).toBe(201);
    expect(m.guard).toHaveBeenCalledWith(USER, "ingestion");
    expect(m.itemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          kind: "document",
          sourceFileKey: `${USER}/abc.pdf`,
          title: "Energy bill March",
          meta: {
            originalName: "Energy_bill  March.pdf",
            size: 120_000,
            type: "application/pdf",
          },
          sourceType: "upload",
          captureSource: "web",
          userId: USER,
          processingStatus: "processing",
          excludeFromPublicRooms: true,
        },
      }),
    );
    // No cover until the import renders page 1
    expect(m.itemCreate.mock.calls[0][0].data.fileKey).toBeUndefined();
  });

  it("accounts the PDF's bytes and the new item", async () => {
    await call(body());
    expect(m.userUpdate).toHaveBeenCalledWith({
      where: { id: USER },
      data: {
        itemCount: { increment: 1 },
        storageUsedBytes: { increment: 120_000 },
      },
    });
  });

  it("enqueues the import for the new item", async () => {
    await call(body());
    expect(m.enqueue).toHaveBeenCalledWith({ itemId: "item-1", userId: USER });
    expect(m.logActivity).toHaveBeenCalledWith(USER, "item_create", {
      itemId: "item-1",
      kind: "document",
    });
  });
});
