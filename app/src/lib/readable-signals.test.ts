import { describe, expect, it } from "vitest";
import {
  extractReadableSignals,
  revealStreamingContent,
} from "./readable-signals";

describe("revealStreamingContent", () => {
  it("strips a bare hidden attribute (React streaming SSR)", () => {
    expect(revealStreamingContent("<div hidden>content</div>")).toBe(
      "<div>content</div>",
    );
  });

  it("strips bare hidden alongside other attributes", () => {
    expect(revealStreamingContent('<div class="x" hidden>c</div>')).toBe(
      '<div class="x">c</div>',
    );
    expect(revealStreamingContent('<div hidden id="S:0">c</div>')).toBe(
      '<div id="S:0">c</div>',
    );
  });

  it('leaves hidden="until-found" collapsed content hidden', () => {
    const html = '<div hidden="until-found">show more</div>';
    // Untouched — author-hidden content must not enter the classification.
    expect(revealStreamingContent(html)).toBe(html);
  });

  it("does not produce malformed markup for valued hidden attributes", () => {
    const out = revealStreamingContent('<div hidden="hidden">c</div>');
    expect(out).toBe('<div hidden="hidden">c</div>');
    expect(out).not.toContain("<div=");
  });

  it("does not touch unrelated attributes containing 'hidden'", () => {
    const html = '<div data-hidden="true">c</div>';
    expect(revealStreamingContent(html)).toBe(html);
  });
});

describe("extractReadableSignals", () => {
  // `error` uniquely marks a Readability/JSDOM throw, so the (side-effect-free)
  // module's caller can warn without confusing it for a genuine no-content page.
  it("leaves error unset when content is extracted", () => {
    const html = `<html><body><article><p>${"word ".repeat(120)}</p></article></body></html>`;
    const signals = extractReadableSignals(html, "https://example.com/post");
    expect(signals.articleContent).not.toBeNull();
    expect(signals.error).toBeUndefined();
  });

  it("leaves error unset for a genuine no-content page", () => {
    const signals = extractReadableSignals(
      "<html><body></body></html>",
      "https://example.com/",
    );
    expect(signals.articleContent).toBeNull();
    expect(signals.error).toBeUndefined();
  });
});
