import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getUser: vi.fn(), findFirst: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: () => m.getUser(),
}));
vi.mock("@/lib/db", () => ({ default: { item: { findFirst: m.findFirst } } }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { itemViewableWhere } from "@/lib/items/access";
import { GET } from "./route";

const call = (id: string) =>
  GET({} as unknown as Parameters<typeof GET>[0], {
    params: Promise.resolve({ id }),
  });

const pages = [
  { position: 0, fileKey: "u/p1.jpg", width: 1700, height: 2400 },
  { position: 1, fileKey: "u/p2.jpg", width: 1700, height: 2400 },
];

beforeEach(() => {
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("GET /api/v1/items/[id]/pages", () => {
  it("returns the document's pages in order", async () => {
    m.findFirst.mockResolvedValue({ documentPages: pages });
    const res = await call("doc-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pages });
    expect(m.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          documentPages: expect.objectContaining({
            orderBy: { position: "asc" },
          }),
        },
      }),
    );
  });

  it("only finds documents the viewer may see", async () => {
    m.findFirst.mockResolvedValue(null);
    await call("doc-1");
    expect(m.findFirst.mock.calls[0][0].where).toEqual({
      id: "doc-1",
      kind: "document",
      ...itemViewableWhere("user-1"),
    });
  });

  it("applies the anonymous viewing rules when signed out", async () => {
    m.getUser.mockResolvedValue({ data: { user: null } });
    m.findFirst.mockResolvedValue(null);
    await call("doc-1");
    expect(m.findFirst.mock.calls[0][0].where).toEqual({
      id: "doc-1",
      kind: "document",
      ...itemViewableWhere(null),
    });
  });

  it("is a 404 for a missing, private or non-document item", async () => {
    m.findFirst.mockResolvedValue(null);
    expect((await call("x")).status).toBe(404);
  });
});
