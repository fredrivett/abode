import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getModifierKey,
  getModifierKeySymbol,
  isApplePlatform,
} from "./keyboard";

describe("keyboard utilities", () => {
  // Store original navigator
  const originalNavigator = global.navigator;

  beforeEach(() => {
    // Reset navigator before each test
    vi.stubGlobal("navigator", {});
  });

  afterEach(() => {
    // Restore original navigator
    vi.stubGlobal("navigator", originalNavigator);
  });

  describe("isApplePlatform", () => {
    describe("with userAgentData (modern Chromium browsers)", () => {
      it("returns true for macOS", () => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "macOS" },
        });
        expect(isApplePlatform()).toBe(true);
      });

      it("returns true for iOS", () => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "iOS" },
        });
        expect(isApplePlatform()).toBe(true);
      });

      it("returns false for Windows", () => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "Windows" },
        });
        expect(isApplePlatform()).toBe(false);
      });

      it("returns false for Linux", () => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "Linux" },
        });
        expect(isApplePlatform()).toBe(false);
      });

      it("returns false for Android", () => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "Android" },
        });
        expect(isApplePlatform()).toBe(false);
      });
    });

    describe("with navigator.platform (Safari, Firefox)", () => {
      it("returns true for MacIntel", () => {
        vi.stubGlobal("navigator", {
          platform: "MacIntel",
          userAgent: "",
        });
        expect(isApplePlatform()).toBe(true);
      });

      it("returns true for MacPPC", () => {
        vi.stubGlobal("navigator", {
          platform: "MacPPC",
          userAgent: "",
        });
        expect(isApplePlatform()).toBe(true);
      });

      it("returns true for iPhone", () => {
        vi.stubGlobal("navigator", {
          platform: "iPhone",
          userAgent: "",
        });
        expect(isApplePlatform()).toBe(true);
      });

      it("returns true for iPad", () => {
        vi.stubGlobal("navigator", {
          platform: "iPad",
          userAgent: "",
        });
        expect(isApplePlatform()).toBe(true);
      });

      it("returns false for Win32", () => {
        vi.stubGlobal("navigator", {
          platform: "Win32",
          userAgent: "",
        });
        expect(isApplePlatform()).toBe(false);
      });

      it("returns false for Linux x86_64", () => {
        vi.stubGlobal("navigator", {
          platform: "Linux x86_64",
          userAgent: "",
        });
        expect(isApplePlatform()).toBe(false);
      });
    });

    describe("with userAgent fallback", () => {
      it("returns true when userAgent contains Mac", () => {
        vi.stubGlobal("navigator", {
          platform: "",
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        });
        expect(isApplePlatform()).toBe(true);
      });

      it("returns true when userAgent contains iPhone", () => {
        vi.stubGlobal("navigator", {
          platform: "",
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
        });
        expect(isApplePlatform()).toBe(true);
      });

      it("returns true when userAgent contains iPad", () => {
        vi.stubGlobal("navigator", {
          platform: "",
          userAgent:
            "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
        });
        expect(isApplePlatform()).toBe(true);
      });

      it("returns true when userAgent contains iPod", () => {
        vi.stubGlobal("navigator", {
          platform: "",
          userAgent:
            "Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
        });
        expect(isApplePlatform()).toBe(true);
      });

      it("returns false for Windows userAgent", () => {
        vi.stubGlobal("navigator", {
          platform: "",
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        });
        expect(isApplePlatform()).toBe(false);
      });

      it("returns false for Linux userAgent", () => {
        vi.stubGlobal("navigator", {
          platform: "",
          userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        });
        expect(isApplePlatform()).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("returns false when navigator is undefined", () => {
        vi.stubGlobal("navigator", undefined);
        expect(isApplePlatform()).toBe(false);
      });

      it("prioritizes userAgentData over platform", () => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "Windows" },
          platform: "MacIntel", // This should be ignored
        });
        expect(isApplePlatform()).toBe(false);
      });

      it("prioritizes platform over userAgent", () => {
        vi.stubGlobal("navigator", {
          platform: "Win32",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", // This should be ignored
        });
        expect(isApplePlatform()).toBe(false);
      });
    });
  });

  describe("getModifierKey", () => {
    it("returns metaKey on Apple platforms", () => {
      vi.stubGlobal("navigator", {
        userAgentData: { platform: "macOS" },
      });

      const event = {
        metaKey: true,
        ctrlKey: false,
      } as KeyboardEvent;

      expect(getModifierKey(event)).toBe(true);
    });

    it("returns ctrlKey on non-Apple platforms", () => {
      vi.stubGlobal("navigator", {
        userAgentData: { platform: "Windows" },
      });

      const event = {
        metaKey: false,
        ctrlKey: true,
      } as KeyboardEvent;

      expect(getModifierKey(event)).toBe(true);
    });

    it("returns false when neither modifier is pressed on Apple", () => {
      vi.stubGlobal("navigator", {
        userAgentData: { platform: "macOS" },
      });

      const event = {
        metaKey: false,
        ctrlKey: true,
      } as KeyboardEvent;

      expect(getModifierKey(event)).toBe(false);
    });

    it("returns false when neither modifier is pressed on Windows", () => {
      vi.stubGlobal("navigator", {
        userAgentData: { platform: "Windows" },
      });

      const event = {
        metaKey: true,
        ctrlKey: false,
      } as KeyboardEvent;

      expect(getModifierKey(event)).toBe(false);
    });
  });

  describe("getModifierKeySymbol", () => {
    it("returns ⌘ on Apple platforms", () => {
      vi.stubGlobal("navigator", {
        userAgentData: { platform: "macOS" },
      });

      expect(getModifierKeySymbol()).toBe("⌘");
    });

    it("returns Ctrl on non-Apple platforms", () => {
      vi.stubGlobal("navigator", {
        userAgentData: { platform: "Windows" },
      });

      expect(getModifierKeySymbol()).toBe("Ctrl");
    });

    it("returns Ctrl on Linux", () => {
      vi.stubGlobal("navigator", {
        userAgentData: { platform: "Linux" },
      });

      expect(getModifierKeySymbol()).toBe("Ctrl");
    });
  });
});
