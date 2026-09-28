import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.hoisted(() => vi.fn());
const findFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/authenticate-request", () => ({ authenticateRequest }));
vi.mock("@/lib/db", () => ({ default: { itemImport: { findFirst } } }));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { GET } from "./route";

const req = {} as NextRequest;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/v1/imports/[id]", () => {
  beforeEach(() => {
    authenticateRequest.mockReset().mockResolvedValue({ user: { id: "u1" } });
    findFirst.mockReset();
  });

  it("401 when unauthenticated", async () => {
    authenticateRequest.mockResolvedValue(null);
    expect((await GET(req, ctx("imp1"))).status).toBe(401);
  });

  it("404 when the import doesn't exist / isn't the caller's", async () => {
    findFirst.mockResolvedValue(null);
    expect((await GET(req, ctx("imp1"))).status).toBe(404);
    // scoped to the authenticated user
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "imp1", userId: "u1" },
      }),
    );
  });

  it("200 returns the import for the owner", async () => {
    findFirst.mockResolvedValue({
      id: "imp1",
      source: "literal",
      status: "importing",
      totalCount: 10,
      importedCount: 3,
      skippedCount: 1,
      failedCount: 0,
      error: null,
      createdAt: new Date(),
      completedAt: null,
    });
    const res = await GET(req, ctx("imp1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: "imp1",
      status: "importing",
      importedCount: 3,
    });
  });
});
