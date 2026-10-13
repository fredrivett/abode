import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/url", () => ({ getAppBaseUrl: () => "https://abode.test" }));

import {
  formatHighlightQuote,
  highlightQuoteLayout,
  highlightSharePath,
  highlightShareUrl,
  normalizeHighlightText,
  truncateAtWord,
} from "./share";

const target = { username: "fred", itemId: "item-1", highlightId: "hl-1" };

describe("highlightSharePath / highlightShareUrl", () => {
  it("builds the public highlight path under the owner's item", () => {
    expect(highlightSharePath(target)).toBe(
      "/@fred/items/item-1/highlights/hl-1",
    );
  });

  it("prefixes the deployment's base url", () => {
    expect(highlightShareUrl(target)).toBe(
      "https://abode.test/@fred/items/item-1/highlights/hl-1",
    );
  });
});

describe("normalizeHighlightText", () => {
  it("collapses newlines and repeated spaces", () => {
    expect(normalizeHighlightText("  one\n\ntwo   three ")).toBe(
      "one two three",
    );
  });
});

describe("truncateAtWord", () => {
  it("leaves short text untouched", () => {
    expect(truncateAtWord("short text", 50)).toBe("short text");
  });

  it("cuts at a word boundary and adds an ellipsis", () => {
    const result = truncateAtWord("the quick brown fox jumps over", 18);
    expect(result).toBe("the quick brown…");
    expect(result.length).toBeLessThanOrEqual(18);
  });

  it("hard-cuts a single long word rather than dropping everything", () => {
    expect(truncateAtWord("a".repeat(30), 10)).toBe(`${"a".repeat(9)}…`);
  });

  it("strips trailing punctuation before the ellipsis", () => {
    expect(truncateAtWord("first clause, second clause here", 15)).toBe(
      "first clause…",
    );
  });
});

describe("highlightQuoteLayout", () => {
  it("uses the largest type for short quotes", () => {
    expect(highlightQuoteLayout("Small is beautiful.")).toEqual({
      text: "Small is beautiful.",
      fontSize: 60,
    });
  });

  it("steps the type down as quotes get longer", () => {
    const sizes = [80, 150, 230, 290].map(
      (n) => highlightQuoteLayout("x ".repeat(n / 2)).fontSize,
    );
    expect(sizes).toEqual([60, 50, 42, 36]);
  });

  it("truncates very long quotes so they fit the card", () => {
    const { text, fontSize } = highlightQuoteLayout("word ".repeat(200));
    expect(fontSize).toBe(36);
    expect(text.length).toBeLessThanOrEqual(300);
    expect(text.endsWith("…")).toBe(true);
  });
});

describe("formatHighlightQuote", () => {
  it("formats quote, attribution and link on separate lines", () => {
    expect(
      formatHighlightQuote({
        text: "Less,\nbut better.",
        title: "Dieter Rams",
        url: "https://abode.test/x",
      }),
    ).toBe("“Less, but better.”\n— Dieter Rams\nhttps://abode.test/x");
  });

  it("omits the attribution line without a title", () => {
    expect(
      formatHighlightQuote({ text: "Hi", title: null, url: "https://a.b" }),
    ).toBe("“Hi”\nhttps://a.b");
  });
});
