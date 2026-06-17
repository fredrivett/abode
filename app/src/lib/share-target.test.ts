import { describe, expect, it } from "vitest";
import { extractSharedUrl } from "./share-target";

describe("extractSharedUrl", () => {
  it("returns the url param when it is a valid URL", () => {
    expect(extractSharedUrl({ url: "https://example.com/chair" })).toBe(
      "https://example.com/chair",
    );
  });

  it("trims whitespace around the url param", () => {
    expect(extractSharedUrl({ url: "  https://example.com  " })).toBe(
      "https://example.com",
    );
  });

  it("falls back to a URL embedded in the text param", () => {
    expect(
      extractSharedUrl({
        text: "Check out this chair https://example.com/chair so good",
      }),
    ).toBe("https://example.com/chair");
  });

  it("falls back to the title param when url and text have no URL", () => {
    expect(
      extractSharedUrl({ text: "no link here", title: "https://example.com" }),
    ).toBe("https://example.com");
  });

  it("prefers the url param over text and title", () => {
    expect(
      extractSharedUrl({
        url: "https://example.com/from-url",
        text: "https://example.com/from-text",
      }),
    ).toBe("https://example.com/from-url");
  });

  it("uses the first value when a param is repeated", () => {
    expect(
      extractSharedUrl({
        url: ["https://example.com/a", "https://example.com/b"],
      }),
    ).toBe("https://example.com/a");
  });

  it("rejects non-http(s) protocols", () => {
    expect(extractSharedUrl({ url: "javascript:alert(1)" })).toBeNull();
    expect(extractSharedUrl({ url: "ftp://example.com" })).toBeNull();
  });

  it("returns null when no params contain a URL", () => {
    expect(extractSharedUrl({})).toBeNull();
    expect(extractSharedUrl({ text: "just some text" })).toBeNull();
  });
});
