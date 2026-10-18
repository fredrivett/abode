import { afterEach, describe, expect, it, vi } from "vitest";
import {
  currentViewerFrame,
  isRlsEnforced,
  recordViewer,
  runInViewerFrame,
} from "./viewer-context";

describe("viewer frames", () => {
  it("start anonymous and take the recorded viewer", async () => {
    await runInViewerFrame(async () => {
      expect(currentViewerFrame()).toEqual({ viewerId: null });
      recordViewer("user-1");
      await Promise.resolve();
      expect(currentViewerFrame()).toEqual({ viewerId: "user-1" });
    });
  });

  it("carry the viewer through to code the auth helper didn't call", async () => {
    // The auth helper records inside an awaited call; later code still sees it
    const authenticate = async () => recordViewer("user-1");
    const later = async () => currentViewerFrame()?.viewerId;
    const seen = await runInViewerFrame(async () => {
      await authenticate();
      return later();
    });
    expect(seen).toBe("user-1");
  });

  it("keep concurrent requests apart", async () => {
    const request = (viewerId: string) =>
      runInViewerFrame(async () => {
        recordViewer(viewerId);
        await new Promise((resolve) => setTimeout(resolve, 5));
        return currentViewerFrame()?.viewerId;
      });
    expect(await Promise.all([request("a"), request("b")])).toEqual(["a", "b"]);
  });

  it("can't be switched to a different viewer once recorded", async () => {
    await runInViewerFrame(async () => {
      recordViewer("user-1");
      // Re-recording the same user (two auth helpers in one request) is fine
      recordViewer("user-1");
      expect(() => recordViewer("user-2")).toThrow(/different viewer/);
      expect(currentViewerFrame()?.viewerId).toBe("user-1");
    });
  });

  it("don't exist outside a request, where recording is a no-op", () => {
    recordViewer("user-1");
    expect(currentViewerFrame()).toBeUndefined();
  });
});

describe("isRlsEnforced", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless RLS_ENFORCED is exactly true", () => {
    vi.stubEnv("RLS_ENFORCED", "");
    expect(isRlsEnforced()).toBe(false);
    vi.stubEnv("RLS_ENFORCED", "1");
    expect(isRlsEnforced()).toBe(false);
    vi.stubEnv("RLS_ENFORCED", "true");
    expect(isRlsEnforced()).toBe(true);
  });
});
