import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureInstallPrompt } from "@/lib/pwa/install-prompt";
import { getInstallOption } from "./use-install-option";

function stubMedia(matching: string[]) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: matching.includes(query) })),
  );
}

function stubUserAgent(userAgent: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
}

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
const IPAD =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140.0";

describe("getInstallOption", () => {
  let release: () => void;
  beforeEach(() => {
    release = captureInstallPrompt(window);
  });
  afterEach(() => {
    window.dispatchEvent(new Event("appinstalled"));
    release();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("offers the native prompt on a touch device that has one", () => {
    stubMedia(["(pointer: coarse)"]);
    stubUserAgent(ANDROID);
    window.dispatchEvent(
      Object.assign(new Event("beforeinstallprompt"), {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "accepted" }),
      }),
    );
    expect(getInstallOption()).toBe("prompt");
  });

  it("offers the manual steps on iOS", () => {
    stubMedia(["(pointer: coarse)"]);
    stubUserAgent(IPHONE);
    expect(getInstallOption()).toBe("ios");
  });

  it("offers nothing once installed", () => {
    stubMedia(["(pointer: coarse)", "(display-mode: standalone)"]);
    stubUserAgent(IPHONE);
    expect(getInstallOption()).toBeNull();
  });

  it("offers nothing once added to the home screen on iOS", () => {
    stubMedia(["(pointer: coarse)"]);
    stubUserAgent(IPHONE);
    vi.stubGlobal(
      "navigator",
      Object.assign(Object.create(navigator), { standalone: true }),
    );
    expect(getInstallOption()).toBeNull();
  });

  it("treats iPadOS, which reports a Mac user agent, as iOS", () => {
    stubMedia(["(pointer: coarse)"]);
    vi.stubGlobal("navigator", {
      userAgent: IPAD,
      platform: "MacIntel",
      maxTouchPoints: 5,
    });
    expect(getInstallOption()).toBe("ios");
  });

  it("offers nothing on desktop", () => {
    stubMedia([]);
    stubUserAgent(IPHONE);
    expect(getInstallOption()).toBeNull();
  });

  it("offers nothing on a touch browser without an install route", () => {
    stubMedia(["(pointer: coarse)"]);
    stubUserAgent(ANDROID);
    expect(getInstallOption()).toBeNull();
  });
});
