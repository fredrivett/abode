import { describe, expect, it } from "vitest";
import { POSTHOG_PRIVACY_CONFIG } from "./posthog-privacy-config";
import { maskReplayAttribute, REPLAY_PRIVACY_OPTIONS } from "./replay-privacy";
import { scrubEvent } from "./scrub-event";

describe("maskReplayAttribute", () => {
  it.each([
    ["href", "https://example.com/saved-article"],
    ["src", "/api/v1/images/user-1/photo.jpg"],
    ["srcset", "/a.jpg 1x, /b.jpg 2x"],
    ["alt", "A photo of my flat"],
    ["title", "My saved note"],
    ["content", "My private room"],
    ["value", "a saved value"],
    ["aria-label", "Session replays for someone@example.com"],
    ["ARIA-LABEL", "Upper-cased attribute names too"],
    ["data-text", "text shared to abode"],
    ["data-room-json", '{"title":"My room"}'],
    ["data-grid-item", "item-1"],
  ])("blanks %s", (name, value) => {
    expect(maskReplayAttribute(name, value)).toBe("");
  });

  it("keeps UI-state data attributes that drive styling", () => {
    expect(maskReplayAttribute("data-state", "open")).toBe("open");
    expect(maskReplayAttribute("data-slot", "button")).toBe("button");
  });

  it("keeps stylesheet links so replays render", () => {
    const link = document.createElement("link");
    expect(maskReplayAttribute("href", "/_next/static/app.css", link)).toBe(
      "/_next/static/app.css",
    );
  });

  it("keeps layout-only attributes", () => {
    expect(maskReplayAttribute("class", "flex gap-2")).toBe("flex gap-2");
    expect(maskReplayAttribute("width", "320")).toBe("320");
  });

  it("strips background image URLs from inline styles", () => {
    expect(
      maskReplayAttribute(
        "style",
        'height: 10px; background-image: url("https://cdn.example.com/a.jpg?x=(1)")',
      ),
    ).toBe("height: 10px; background-image: none");
  });
});

describe("REPLAY_PRIVACY_OPTIONS", () => {
  it("masks all inputs and text", () => {
    expect(REPLAY_PRIVACY_OPTIONS.maskAllInputs).toBe(true);
    expect(REPLAY_PRIVACY_OPTIONS.maskTextSelector).toBe("*");
  });

  // matches() throws on a malformed selector and fails on a typo'd tag
  it.each(["img", "picture", "video", "audio", "canvas", "iframe"])(
    "blocks <%s> via a valid selector",
    (tag) => {
      const element = document.createElement(tag);
      expect(element.matches(REPLAY_PRIVACY_OPTIONS.blockSelector)).toBe(true);
    },
  );

  it("doesn't block ordinary layout elements", () => {
    const element = document.createElement("div");
    expect(element.matches(REPLAY_PRIVACY_OPTIONS.blockSelector)).toBe(false);
  });
});

describe("POSTHOG_PRIVACY_CONFIG", () => {
  it("scrubs events before they're sent", () => {
    expect(POSTHOG_PRIVACY_CONFIG.before_send).toBe(scrubEvent);
  });

  it("masks content in replay network and page URLs", () => {
    const masked = REPLAY_PRIVACY_OPTIONS.maskCapturedNetworkRequestFn({
      name: "https://abode.test/api/v1/items?q=secret",
      entryType: "resource",
      startTime: 0,
      duration: 0,
    });
    expect(masked.name).toBe("https://abode.test/api/v1/items?q=<masked>");
  });

  it("masks search and shared-content query params in page URLs", () => {
    expect(POSTHOG_PRIVACY_CONFIG.mask_personal_data_properties).toBe(true);
    expect(POSTHOG_PRIVACY_CONFIG.custom_personal_data_properties).toEqual(
      expect.arrayContaining(["q", "search", "url", "text", "title"]),
    );
  });
});
