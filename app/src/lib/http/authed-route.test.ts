import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuthenticate } = vi.hoisted(() => ({ mockAuthenticate: vi.fn() }));

vi.mock("@/lib/auth/authenticate-request", () => ({
  authenticateRequest: mockAuthenticate,
}));
vi.mock("@/lib/posthog-server", () => ({ captureServerException: vi.fn() }));

import type { Principal } from "@/lib/auth/authenticate-request";
import { currentViewerFrame } from "@/lib/viewer-context";
import { authedRoute } from "./authed-route";
import { isViewerFramed } from "./with-viewer";

// A handler for routes without params; must not run unless auth succeeds
const unreachable = vi.fn(
  async (_request: NextRequest, _ctx: { principal: Principal }) =>
    new Response(),
);

const principal = { user: { id: "user-1" }, method: "cookie" };
const request = () =>
  new NextRequest("http://localhost/api/x", {
    method: "POST",
    headers: { origin: "chrome-extension://abc" },
  });

describe("authedRoute", () => {
  beforeEach(() => {
    mockAuthenticate.mockReset();
    unreachable.mockClear();
  });

  it("401s without running the handler when authentication fails", async () => {
    mockAuthenticate.mockResolvedValue(null);
    const response = await authedRoute(
      { tokenScope: "write" },
      unreachable,
    )(request());

    expect(response.status).toBe(401);
    expect(unreachable).not.toHaveBeenCalled();
    expect(mockAuthenticate).toHaveBeenCalledWith(expect.anything(), {
      tokenScope: "write",
    });
  });

  it("passes params and the principal to the handler, inside a viewer frame", async () => {
    mockAuthenticate.mockResolvedValue(principal);
    const route = authedRoute(
      { tokenScope: null },
      async (
        _request,
        ctx: { params: Promise<{ id: string }>; principal: Principal },
      ) =>
        Response.json({
          id: (await ctx.params).id,
          principal: ctx.principal,
          framed: currentViewerFrame() !== undefined,
        }),
    );

    const response = await route(request(), {
      params: Promise.resolve({ id: "item-1" }),
    });
    expect(await response.json()).toEqual({
      id: "item-1",
      principal,
      framed: true,
    });
    expect(isViewerFramed(route)).toBe(true);
  });

  it("runs an allowAnonymous handler for a signed-out request, with a null principal", async () => {
    mockAuthenticate.mockResolvedValue(null);
    const route = authedRoute(
      { credentials: "session", allowAnonymous: true },
      async (_request, { principal }: { principal: Principal | null }) =>
        Response.json({ principal }),
    );

    const response = await route(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ principal: null });
  });

  it("adds CORS headers to the 401 as well as the handler's response", async () => {
    const route = authedRoute({ tokenScope: null, cors: true }, async () =>
      Response.json({}),
    );

    mockAuthenticate.mockResolvedValue(null);
    const denied = await route(request());
    mockAuthenticate.mockResolvedValue(principal);
    const allowed = await route(request());

    for (const response of [denied, allowed]) {
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "chrome-extension://abc",
      );
    }
    expect(denied.status).toBe(401);
  });

  it("500s when the auth lookup itself throws", async () => {
    mockAuthenticate.mockRejectedValue(new Error("db down"));
    const response = await authedRoute(
      { tokenScope: null },
      unreachable,
    )(request());
    expect(response.status).toBe(500);
    expect(unreachable).not.toHaveBeenCalled();
  });
});
