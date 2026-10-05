import { describe, expect, it } from "vitest";
import {
  formatLinkForDisplay,
  getOpenableHref,
  normalizeLinkInput,
} from "./link-href";

describe("getOpenableHref", () => {
  it.each([
    ["https://example.com/a?b=1", "https://example.com/a?b=1"],
    ["http://example.com", "http://example.com/"],
    ["mailto:me@example.com", "mailto:me@example.com"],
    ["tel:+441234567890", "tel:+441234567890"],
    ["  https://example.com  ", "https://example.com/"],
  ])("allows %s", (href, expected) => {
    expect(getOpenableHref(href)).toBe(expected);
  });

  it.each([
    ["javascript:alert(1)"],
    ["JavaScript:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["/relative/path"],
    ["example.com"],
    [""],
    [null],
    [undefined],
  ])("rejects %s", (href) => {
    expect(getOpenableHref(href)).toBeNull();
  });
});

describe("normalizeLinkInput", () => {
  it("keeps a full URL as typed", () => {
    expect(normalizeLinkInput(" https://example.com/a ")).toBe(
      "https://example.com/a",
    );
  });

  it("adds https:// to a bare domain", () => {
    expect(normalizeLinkInput("example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it("treats host:port as a bare domain, not a scheme", () => {
    expect(normalizeLinkInput("localhost:3000/a")).toBe(
      "https://localhost:3000/a",
    );
  });

  it("keeps mailto links", () => {
    expect(normalizeLinkInput("mailto:me@example.com")).toBe(
      "mailto:me@example.com",
    );
  });

  it.each([
    [""],
    ["   "],
    ["notes"],
    ["javascript:alert(1)"],
    ["ftp://example.com"],
  ])("rejects %s", (input) => {
    expect(normalizeLinkInput(input)).toBeNull();
  });
});

describe("formatLinkForDisplay", () => {
  it("drops the scheme, www. and a bare trailing slash", () => {
    expect(formatLinkForDisplay("https://www.example.com/")).toBe(
      "example.com",
    );
  });

  it("keeps the path, query and hash", () => {
    expect(formatLinkForDisplay("https://example.com/a/b?c=1#d")).toBe(
      "example.com/a/b?c=1#d",
    );
  });

  it("drops the mailto: prefix", () => {
    expect(formatLinkForDisplay("mailto:me@example.com")).toBe(
      "me@example.com",
    );
  });

  it("returns unparseable input unchanged", () => {
    expect(formatLinkForDisplay("not a url")).toBe("not a url");
  });
});
