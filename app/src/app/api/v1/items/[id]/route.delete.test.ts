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
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: vi.fn() } }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { DELETE } from "./route";

const USER = "user-1";
const call = (id: string) =>
  DELETE({} as unknown as Parameters<typeof DELETE>[0], {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
  m.remove.mockResolvedValue({ error: null });
});

describe("DELETE /api/v1/items/[id]", () => {
  it("removes a document's page files and updates the counters", async () => {
    m.findUnique.mockResolvedValue({
      userId: USER,
      fileKey: `${USER}/p1.jpg`,
      meta: { size: 500 },
      documentPages: [
        { fileKey: `${USER}/p1.jpg`, originalFileKey: `${USER}/p1-c.jpg` },
      ],
    });
    const res = await call("doc-1");
    expect(res.status).toBe(204);
    expect(m.remove).toHaveBeenCalledWith([
      `${USER}/p1.jpg`,
      `${USER}/p1-c.jpg`,
    ]);
    expect(m.itemDelete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
    expect(m.userUpdate).toHaveBeenCalledWith({
      where: { id: USER },
      data: {
        itemCount: { decrement: 1 },
        storageUsedBytes: { decrement: BigInt(500) },
      },
    });
  });

  it("still deletes the document if removing its files fails", async () => {
    m.findUnique.mockResolvedValue({
      userId: USER,
      fileKey: `${USER}/p1.jpg`,
      meta: null,
      documentPages: [
        { fileKey: `${USER}/p1.jpg`, originalFileKey: `${USER}/p1.jpg` },
      ],
    });
    m.remove.mockResolvedValue({ error: new Error("storage down") });
    expect((await call("doc-1")).status).toBe(204);
    expect(m.itemDelete).toHaveBeenCalled();
  });

  it("removes other kinds' files too (it used to leave them behind)", async () => {
    m.findUnique.mockResolvedValue({
      userId: USER,
      fileKey: `${USER}/photo.jpg`,
      meta: null,
      documentPages: [],
    });
    await call("img-1");
    expect(m.remove).toHaveBeenCalledWith([`${USER}/photo.jpg`]);
  });

  it("treats someone else's item as not found", async () => {
    m.findUnique.mockResolvedValue({
      userId: "someone-else",
      fileKey: null,
      meta: null,
      documentPages: [],
    });
    expect((await call("x")).status).toBe(404);
    expect(m.itemDelete).not.toHaveBeenCalled();
  });
});
