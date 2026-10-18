import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  findFirst: vi.fn(),
  capture: vi.fn(),
}));

const connections = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
  getUserWithMfa: () => m.getUser(),
}));
vi.mock("@/lib/db", () => {
  const client = { item: { findFirst: m.findFirst } };
  // Each connection records itself, so tests can assert which one was used
  const via = (name: string) =>
    new Proxy(client, {
      get: (models, model: string) =>
        new Proxy(models[model as keyof typeof models], {
          get:
            (ops, op: string) =>
            (...args: unknown[]) => {
              connections.push(name);
              return (ops as Record<string, (...a: unknown[]) => unknown>)[op](
                ...args,
              );
            },
        }),
    });
  return { default: via("db"), systemDb: via("systemDb") };
});
vi.mock("@/lib/posthog-server", () => ({ captureServerException: m.capture }));
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
  connections.length = 0;
  m.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("GET /api/v1/items/[id]/pages", () => {
  it("reads on the system connection, gating access itself", async () => {
    m.findFirst.mockResolvedValue({ documentPages: pages });
    await call("doc-1");
    expect(connections).toEqual(["systemDb"]);
  });

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

  it("reports and returns 500 when the lookup fails", async () => {
    m.findFirst.mockRejectedValue(new Error("db down"));
    const res = await call("doc-1");
    expect(res.status).toBe(500);
    expect(m.capture).toHaveBeenCalledWith(
      expect.any(Error),
      undefined,
      expect.objectContaining({ route: "GET /api/v1/items/[id]/pages" }),
    );
  });
});
