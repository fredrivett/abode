import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestShareInvite, checkRateLimit } = vi.hoisted(() => ({
  requestShareInvite: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/invites/share-invite", () => ({ requestShareInvite }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit,
  getClientIp: () => "1.2.3.4",
  getRateLimitHeaders: () => ({}),
}));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));

import { POST } from "./route";

const ITEM_ID = "22222222-2222-4222-8222-222222222222";

const post = (body: unknown) =>
  POST({
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as unknown as NextRequest);

describe("POST /api/v1/share-invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockReturnValue({ allowed: true });
  });

  it("returns the outcome for a valid request", async () => {
    requestShareInvite.mockResolvedValue({
      status: "invited",
      joinPath: "/join?token=t&save=x",
    });

    const res = await post({ itemId: ITEM_ID, email: "a@b.co" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "invited",
      joinPath: "/join?token=t&save=x",
    });
    expect(requestShareInvite).toHaveBeenCalledWith({
      itemId: ITEM_ID,
      email: "a@b.co",
    });
  });

  it("rate limits per IP before doing any work", async () => {
    checkRateLimit.mockReturnValue({ allowed: false });

    const res = await post({ itemId: ITEM_ID, email: "a@b.co" });

    expect(res.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("1.2.3.4", "shareInvite");
    expect(requestShareInvite).not.toHaveBeenCalled();
  });

  it.each([
    [{ email: "a@b.co" }],
    [{ itemId: "not-a-uuid", email: "a@b.co" }],
    [{ itemId: ITEM_ID }],
  ])("400s an invalid body %#", async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(requestShareInvite).not.toHaveBeenCalled();
  });

  it("404s an item that isn't publicly viewable", async () => {
    requestShareInvite.mockResolvedValue({ status: "unavailable" });
    expect((await post({ itemId: ITEM_ID, email: "a@b.co" })).status).toBe(404);
  });

  it("400s with the reason for an invalid email", async () => {
    requestShareInvite.mockResolvedValue({
      status: "invalid_email",
      error: "Please use a permanent email address",
    });
    const res = await post({ itemId: ITEM_ID, email: "a@temp.mail" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      message: "Please use a permanent email address",
    });
  });

  it("500s without leaking internals when something throws", async () => {
    requestShareInvite.mockRejectedValue(new Error("db down"));
    const res = await post({ itemId: ITEM_ID, email: "a@b.co" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Internal server error" });
  });
});
