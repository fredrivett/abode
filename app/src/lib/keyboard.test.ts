import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getModifierKey,
  getModifierKeySymbol,
  isApplePlatform,
  matchesShortcut,
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

  describe("matchesShortcut", () => {
    describe("key matching", () => {
      it("matches lowercase key", () => {
        const event = {
          key: "k",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "k" })).toBe(true);
      });

      it("matches uppercase key (case-insensitive)", () => {
        const event = {
          key: "K",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "k" })).toBe(true);
      });

      it("matches when shortcut key is uppercase", () => {
        const event = {
          key: "k",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "K" })).toBe(true);
      });

      it("does not match different keys", () => {
        const event = {
          key: "j",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "k" })).toBe(false);
      });

      it("matches special keys like Enter", () => {
        const event = {
          key: "Enter",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "Enter" })).toBe(true);
      });

      it("matches Escape key", () => {
        const event = {
          key: "Escape",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "Escape" })).toBe(true);
      });
    });

    describe("modifier key on macOS", () => {
      beforeEach(() => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "macOS" },
        });
      });

      it("matches Cmd+K", () => {
        const event = {
          key: "k",
          metaKey: true,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "k", modifier: true })).toBe(true);
      });

      it("does not match Ctrl+K on macOS (expects Cmd)", () => {
        const event = {
          key: "k",
          metaKey: false,
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "k", modifier: true })).toBe(
          false,
        );
      });

      it("matches when modifier: false and no Cmd pressed", () => {
        const event = {
          key: "k",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "k", modifier: false })).toBe(
          true,
        );
      });

      it("does not match when modifier: false but Cmd is pressed", () => {
        const event = {
          key: "k",
          metaKey: true,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "k", modifier: false })).toBe(
          false,
        );
      });
    });

    describe("modifier key on Windows", () => {
      beforeEach(() => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "Windows" },
        });
      });

      it("matches Ctrl+K", () => {
        const event = {
          key: "k",
          metaKey: false,
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "k", modifier: true })).toBe(true);
      });

      it("does not match Win+K on Windows (expects Ctrl)", () => {
        const event = {
          key: "k",
          metaKey: true,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "k", modifier: true })).toBe(
          false,
        );
      });

      it("matches when modifier: false and no Ctrl pressed", () => {
        const event = {
          key: "k",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(event, { key: "k", modifier: false })).toBe(
          true,
        );
      });
    });

    describe("shift key", () => {
      beforeEach(() => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "Windows" },
        });
      });

      it("matches Ctrl+Shift+K (with uppercase K from shift)", () => {
        const event = {
          key: "K",
          metaKey: false,
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
        } as KeyboardEvent;
        expect(
          matchesShortcut(event, { key: "k", modifier: true, shift: true }),
        ).toBe(true);
      });

      it("does not match Ctrl+K when shift: true is required", () => {
        const event = {
          key: "k",
          metaKey: false,
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(
          matchesShortcut(event, { key: "k", modifier: true, shift: true }),
        ).toBe(false);
      });

      it("matches Ctrl+K when shift: false is specified", () => {
        const event = {
          key: "k",
          metaKey: false,
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(
          matchesShortcut(event, { key: "k", modifier: true, shift: false }),
        ).toBe(true);
      });

      it("does not match Ctrl+Shift+K when shift: false is specified", () => {
        const event = {
          key: "K",
          metaKey: false,
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
        } as KeyboardEvent;
        expect(
          matchesShortcut(event, { key: "k", modifier: true, shift: false }),
        ).toBe(false);
      });
    });

    describe("alt key", () => {
      beforeEach(() => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "Windows" },
        });
      });

      it("matches Ctrl+Alt+K", () => {
        const event = {
          key: "k",
          metaKey: false,
          ctrlKey: true,
          shiftKey: false,
          altKey: true,
        } as KeyboardEvent;
        expect(
          matchesShortcut(event, { key: "k", modifier: true, alt: true }),
        ).toBe(true);
      });

      it("does not match Ctrl+K when alt: true is required", () => {
        const event = {
          key: "k",
          metaKey: false,
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(
          matchesShortcut(event, { key: "k", modifier: true, alt: true }),
        ).toBe(false);
      });
    });

    describe("undefined modifiers (ignore)", () => {
      beforeEach(() => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "Windows" },
        });
      });

      it("ignores modifier key when not specified", () => {
        const eventWithCtrl = {
          key: "k",
          metaKey: false,
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        const eventWithoutCtrl = {
          key: "k",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(eventWithCtrl, { key: "k" })).toBe(true);
        expect(matchesShortcut(eventWithoutCtrl, { key: "k" })).toBe(true);
      });

      it("ignores shift key when not specified", () => {
        const eventWithShift = {
          key: "K",
          metaKey: false,
          ctrlKey: false,
          shiftKey: true,
          altKey: false,
        } as KeyboardEvent;
        const eventWithoutShift = {
          key: "k",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(eventWithShift, { key: "k" })).toBe(true);
        expect(matchesShortcut(eventWithoutShift, { key: "k" })).toBe(true);
      });

      it("ignores alt key when not specified", () => {
        const eventWithAlt = {
          key: "k",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: true,
        } as KeyboardEvent;
        const eventWithoutAlt = {
          key: "k",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        } as KeyboardEvent;
        expect(matchesShortcut(eventWithAlt, { key: "k" })).toBe(true);
        expect(matchesShortcut(eventWithoutAlt, { key: "k" })).toBe(true);
      });
    });

    describe("complex shortcuts", () => {
      it("matches Cmd+Shift+K on macOS", () => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "macOS" },
        });
        const event = {
          key: "K",
          metaKey: true,
          ctrlKey: false,
          shiftKey: true,
          altKey: false,
        } as KeyboardEvent;
        expect(
          matchesShortcut(event, { key: "k", modifier: true, shift: true }),
        ).toBe(true);
      });

      it("matches Ctrl+Shift+Enter on Windows", () => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "Windows" },
        });
        const event = {
          key: "Enter",
          metaKey: false,
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
        } as KeyboardEvent;
        expect(
          matchesShortcut(event, { key: "Enter", modifier: true, shift: true }),
        ).toBe(true);
      });

      it("matches Cmd+Alt+S on macOS", () => {
        vi.stubGlobal("navigator", {
          userAgentData: { platform: "macOS" },
        });
        const event = {
          key: "s",
          metaKey: true,
          ctrlKey: false,
          shiftKey: false,
          altKey: true,
        } as KeyboardEvent;
        expect(
          matchesShortcut(event, { key: "s", modifier: true, alt: true }),
        ).toBe(true);
      });
    });
  });
});
