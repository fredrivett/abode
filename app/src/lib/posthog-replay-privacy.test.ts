import { describe, expect, it } from "vitest";
import {
  maskReplayAttribute,
  REPLAY_PRIVACY_OPTIONS,
} from "./posthog-replay-privacy";

describe("maskReplayAttribute", () => {
  it.each([
    ["href", "https://example.com/saved-article"],
    ["src", "/api/v1/images/user-1/photo.jpg"],
    ["srcset", "/a.jpg 1x, /b.jpg 2x"],
    ["alt", "A photo of my flat"],
    ["title", "My saved note"],
    ["aria-label", "Session replays for someone@example.com"],
    ["ARIA-LABEL", "Upper-cased attribute names too"],
  ])("blanks %s", (name, value) => {
    expect(maskReplayAttribute(name, value)).toBe("");
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
  it("masks all inputs and text, and blocks media", () => {
    expect(REPLAY_PRIVACY_OPTIONS.maskAllInputs).toBe(true);
    expect(REPLAY_PRIVACY_OPTIONS.maskTextSelector).toBe("*");
    for (const tag of ["img", "video", "canvas", "iframe"]) {
      expect(REPLAY_PRIVACY_OPTIONS.blockSelector).toContain(tag);
    }
  });
});
