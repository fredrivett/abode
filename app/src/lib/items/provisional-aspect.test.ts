import { describe, expect, it } from "vitest";
import { provisionalUrlAspect, readAspectHint } from "./provisional-aspect";

describe("provisionalUrlAspect", () => {
  it("returns 16:9 for YouTube videos", () => {
    expect(
      provisionalUrlAspect("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toEqual({
      width: 16,
      height: 9,
    });
    expect(provisionalUrlAspect("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      width: 16,
      height: 9,
    });
  });

  it("returns 16:9 for Vimeo videos", () => {
    expect(provisionalUrlAspect("https://vimeo.com/123456789")).toEqual({
      width: 16,
      height: 9,
    });
  });

  it("returns null for tweets — completed tweets take their media's aspect, not 16:9", () => {
    expect(
      provisionalUrlAspect("https://twitter.com/jack/status/20"),
    ).toBeNull();
    expect(provisionalUrlAspect("https://x.com/jack/status/20")).toBeNull();
  });

  it("returns null for kinds that need the page body", () => {
    // Article / product / generic pages can't be classified from the URL alone
    expect(provisionalUrlAspect("https://example.com/some-article")).toBeNull();
    expect(
      provisionalUrlAspect("https://www.amazon.com/dp/B0000000"),
    ).toBeNull();
  });

  it("returns null for direct image URLs (real dimensions arrive later)", () => {
    expect(provisionalUrlAspect("https://example.com/photo.jpg")).toBeNull();
  });

  it("returns null for a non-tweet Twitter URL (e.g. a profile)", () => {
    expect(provisionalUrlAspect("https://x.com/jack")).toBeNull();
  });

  it("returns null for malformed URLs", () => {
    expect(provisionalUrlAspect("not a url")).toBeNull();
    expect(provisionalUrlAspect("")).toBeNull();
  });
});

describe("readAspectHint", () => {
  it("reads a valid stored hint", () => {
    expect(readAspectHint({ aspectHint: { width: 16, height: 9 } })).toEqual({
      width: 16,
      height: 9,
    });
  });

  it("returns null when absent, null, or malformed", () => {
    expect(readAspectHint(null)).toBeNull();
    expect(readAspectHint(undefined)).toBeNull();
    expect(readAspectHint({})).toBeNull();
    expect(
      readAspectHint({ aspectHint: { width: "16", height: 9 } }),
    ).toBeNull();
    expect(readAspectHint({ aspectHint: 42 })).toBeNull();
  });
});
