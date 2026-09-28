import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedBook } from "@/lib/imports/types";

const authenticateRequest = vi.hoisted(() => vi.fn());
const fetchLiteralBooks = vi.hoisted(() => vi.fn());
const isTriggerConfigured = vi.hoisted(() => vi.fn());
const batchTrigger = vi.hoisted(() => vi.fn());
const findFirst = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/safe-fetch", () => ({ safeFetch: vi.fn() }));
vi.mock("@/lib/auth/authenticate-request", () => ({ authenticateRequest }));
vi.mock("@/lib/imports/literal/adapter", () => ({ fetchLiteralBooks }));
vi.mock("@/lib/trigger/item-runs", () => ({ isTriggerConfigured }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { batchTrigger } }));
vi.mock("@/lib/db", () => ({
  default: { itemImport: { findFirst, create } },
}));
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => null,
  captureServerException: vi.fn(),
}));
vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
  }),
}));

import { LiteralApiError } from "@/lib/imports/literal/client";
import { POST } from "./route";

const req = (body: unknown): NextRequest =>
  ({ json: async () => body }) as unknown as NextRequest;

const book = (): NormalizedBook => ({
  sourceId: crypto.randomUUID(),
  title: "B",
  subtitle: null,
  description: null,
  authors: [],
  publisher: null,
  publishedAt: null,
  isbn: null,
  pageCount: null,
  language: null,
  coverUrl: null,
  addedAt: null,
  reading: {
    status: "read",
    rating: null,
    review: null,
    finishedAt: null,
    finishedAtPrecision: null,
  },
});

describe("POST /api/v1/imports/literal", () => {
  beforeEach(() => {
    authenticateRequest.mockReset().mockResolvedValue({ user: { id: "u1" } });
    isTriggerConfigured.mockReset().mockReturnValue(true);
    fetchLiteralBooks.mockReset();
    batchTrigger.mockReset().mockResolvedValue({});
    findFirst.mockReset().mockResolvedValue(null);
    create.mockReset().mockResolvedValue({ id: "imp1" });
  });

  it("401 when unauthenticated", async () => {
    authenticateRequest.mockResolvedValue(null);
    expect((await POST(req({ token: "t" }))).status).toBe(401);
  });

  it("503 when the background queue isn't configured", async () => {
    isTriggerConfigured.mockReturnValue(false);
    expect((await POST(req({ token: "t" }))).status).toBe(503);
  });

  it("400 on an invalid body (no token / credentials)", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ email: "not-an-email" }))).status).toBe(400);
  });

  it("409 when an import is already in progress", async () => {
    findFirst.mockResolvedValue({ id: "active1" });
    const res = await POST(req({ token: "t" }));
    expect(res.status).toBe(409);
    expect(fetchLiteralBooks).not.toHaveBeenCalled();
  });

  it("502 when the Literal fetch fails", async () => {
    fetchLiteralBooks.mockRejectedValue(new LiteralApiError("bad creds"));
    const res = await POST(req({ token: "t" }));
    expect(res.status).toBe(502);
    expect(batchTrigger).not.toHaveBeenCalled();
  });

  it("200 with total 0 for an empty library (no task triggered)", async () => {
    fetchLiteralBooks.mockResolvedValue([]);
    const res = await POST(req({ token: "t" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ total: 0 });
    expect(batchTrigger).not.toHaveBeenCalled();
  });

  it("202 creates the import and batch-triggers the writer", async () => {
    fetchLiteralBooks.mockResolvedValue([book(), book()]);
    const res = await POST(req({ token: "t" }));

    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ importId: "imp1", total: 2 });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "literal",
          status: "importing",
          totalCount: 2,
        }),
      }),
    );
    // Two books fit one chunk → one batched run carrying both.
    const runs = batchTrigger.mock.calls[0][1];
    expect(runs).toHaveLength(1);
    expect(runs[0].payload).toMatchObject({ userId: "u1", importId: "imp1" });
    expect(runs[0].payload.books).toHaveLength(2);
  });
});
