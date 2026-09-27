import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  remove: vi.fn(),
  findUnique: vi.fn(),
  itemDelete: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    storage: { from: () => ({ remove: m.remove }) },
  }),
  getUserWithMfa: () => m.getUser(),
}));
vi.mock("@/lib/db", () => ({
  default: {
    item: { findUnique: m.findUnique },
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({ item: { delete: m.itemDelete }, user: { update: m.userUpdate } }),
  },
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { DELETE } from "./route";

const USER = "user-1";

function call(id: string) {
  const request = {
    json: async () => ({ id }),
  } as unknown as Parameters<typeof DELETE>[0];
  return DELETE(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
  m.remove.mockResolvedValue({ error: null });
});

describe("DELETE /api/v1/items", () => {
  it("removes every page file of a document, once each", async () => {
    m.findUnique.mockResolvedValue({
      id: "doc-1",
      userId: USER,
      fileKey: `${USER}/p1.jpg`,
      meta: { size: 1000 },
      documentPages: [
        { fileKey: `${USER}/p1.jpg`, originalFileKey: `${USER}/p1-c.jpg` },
        { fileKey: `${USER}/p2.jpg`, originalFileKey: `${USER}/p2.jpg` },
      ],
    });
    const res = await call("doc-1");
    expect(res.status).toBe(200);
    expect(m.remove).toHaveBeenCalledWith([
      `${USER}/p1.jpg`,
      `${USER}/p1-c.jpg`,
      `${USER}/p2.jpg`,
    ]);
    expect(m.userUpdate).toHaveBeenCalledWith({
      where: { id: USER },
      data: {
        itemCount: { decrement: 1 },
        storageUsedBytes: { decrement: BigInt(1000) },
      },
    });
  });

  it("still removes just the file for other kinds", async () => {
    m.findUnique.mockResolvedValue({
      id: "img-1",
      userId: USER,
      fileKey: `${USER}/photo.jpg`,
      meta: null,
      documentPages: [],
    });
    await call("img-1");
    expect(m.remove).toHaveBeenCalledWith([`${USER}/photo.jpg`]);
  });

  it("doesn't touch storage for an item without files", async () => {
    m.findUnique.mockResolvedValue({
      id: "url-1",
      userId: USER,
      fileKey: null,
      meta: null,
      documentPages: [],
    });
    await call("url-1");
    expect(m.remove).not.toHaveBeenCalled();
    expect(m.itemDelete).toHaveBeenCalled();
  });

  it("refuses to delete someone else's item", async () => {
    m.findUnique.mockResolvedValue({
      id: "x",
      userId: "someone-else",
      fileKey: null,
      meta: null,
      documentPages: [],
    });
    expect((await call("x")).status).toBe(403);
    expect(m.remove).not.toHaveBeenCalled();
  });
});
