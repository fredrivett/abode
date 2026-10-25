import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentViewerFrame, runInViewerFrame } from "@/lib/viewer-context";

// React's `cache` only memoises inside a server render; stand in for renders
// (one per test, reset in beforeEach) so the test can see how often Supabase
// Auth is actually asked, and that nothing carries over between renders
const { getUser, getClaims, render } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  render: { id: 0 },
}));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    cache: <T>(fn: () => T) => {
      let renderId: number | null = null;
      let result: T;
      return (): T => {
        if (renderId !== render.id) {
          renderId = render.id;
          result = fn();
        }
        return result;
      };
    },
  };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser,
      getClaims,
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal1", nextLevel: "aal1" },
          error: null,
        }),
        listFactors: async () => ({ data: { totp: [] }, error: null }),
      },
    },
  }),
}));

import { getAuthUser, getRequestClaims, getRequestUserWithMfa } from "./server";

describe("request-scoped auth", () => {
  beforeEach(() => {
    render.id += 1;
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("asks Supabase Auth once however many layouts and pages resolve the user", async () => {
    const [layout, page, header] = await Promise.all([
      getRequestUserWithMfa(),
      getRequestUserWithMfa(),
      getAuthUser(),
    ]);
    await Promise.all([getRequestClaims(), getRequestClaims()]);

    expect(layout.data.user?.id).toBe("u1");
    expect(page.data.user?.id).toBe("u1");
    expect(header?.id).toBe("u1");
    expect(getUser).toHaveBeenCalledOnce();
    expect(getClaims).toHaveBeenCalledOnce();
  });

  it("records the viewer for every caller, not only the first", async () => {
    await runInViewerFrame(() => getRequestUserWithMfa());
    const viewerId = await runInViewerFrame(async () => {
      await getRequestUserWithMfa();
      return currentViewerFrame()?.viewerId;
    });
    expect(viewerId).toBe("u1");
  });

  it("asks again in the next render, so one request's user never leaks into another", async () => {
    expect((await getRequestUserWithMfa()).data.user?.id).toBe("u1");

    render.id += 1;
    getUser.mockResolvedValue({ data: { user: { id: "u2" } }, error: null });
    expect((await getRequestUserWithMfa()).data.user?.id).toBe("u2");
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});
