import { beforeEach, describe, expect, test } from "vitest";
import {
  createAnchor,
  createQuoteSelector,
  fromRange,
  toRange,
  wrapRangeWithHighlight,
} from "./dom-anchoring";

describe("dom-anchoring", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  describe("fromRange", () => {
    test("calculates offset for simple text node", () => {
      container.textContent = "Hello world";
      const textNode = container.firstChild as Text;

      const range = document.createRange();
      range.setStart(textNode, 6);
      range.setEnd(textNode, 11);

      const position = fromRange(container, range);

      expect(position).toEqual({ start: 6, end: 11 });
      expect(range.toString()).toBe("world");
    });

    test("calculates offset across multiple text nodes", () => {
      container.innerHTML = "Hello <strong>world</strong>!";
      // Text nodes: "Hello " (6 chars), "world" (5 chars), "!" (1 char)

      const strongText = container.querySelector("strong")?.firstChild as Text;
      const range = document.createRange();
      range.setStart(strongText, 0);
      range.setEnd(strongText, 5);

      const position = fromRange(container, range);

      expect(position).toEqual({ start: 6, end: 11 });
      expect(range.toString()).toBe("world");
    });

    test("calculates offset spanning multiple elements", () => {
      container.innerHTML = "Hello <strong>bold</strong> text";
      // Text nodes: "Hello " (6), "bold" (4), " text" (5)

      const helloNode = container.firstChild as Text;
      const textNode = container.lastChild as Text;

      const range = document.createRange();
      range.setStart(helloNode, 0);
      range.setEnd(textNode, 5);

      const position = fromRange(container, range);

      expect(position).toEqual({ start: 0, end: 15 });
      expect(range.toString()).toBe("Hello bold text");
    });

    test("handles nested elements", () => {
      container.innerHTML =
        "<p>First <em>italic <strong>bold</strong></em> end</p>";
      // Text: "First " (6) + "italic " (7) + "bold" (4) + " end" (4) = 21

      const boldText = container.querySelector("strong")?.firstChild as Text;
      const range = document.createRange();
      range.setStart(boldText, 0);
      range.setEnd(boldText, 4);

      const position = fromRange(container, range);

      expect(position).toEqual({ start: 13, end: 17 });
    });
  });

  describe("toRange", () => {
    test("converts offsets to range in simple text", () => {
      container.textContent = "Hello world";

      const range = toRange(container, 6, 11);

      expect(range).not.toBeNull();
      expect(range?.toString()).toBe("world");
    });

    test("converts offsets spanning multiple elements", () => {
      container.innerHTML = "Hello <strong>world</strong>!";

      const range = toRange(container, 0, 12);

      expect(range).not.toBeNull();
      expect(range?.toString()).toBe("Hello world!");
    });

    test("converts offset within nested element", () => {
      container.innerHTML = "<p>First <em>italic</em> end</p>";

      const range = toRange(container, 6, 12);

      expect(range).not.toBeNull();
      expect(range?.toString()).toBe("italic");
    });

    test("returns null for out of bounds offsets", () => {
      container.textContent = "Short";

      const range = toRange(container, 0, 100);

      expect(range).toBeNull();
    });

    test("handles empty container", () => {
      container.textContent = "";

      const range = toRange(container, 0, 5);

      expect(range).toBeNull();
    });
  });

  describe("fromRange and toRange roundtrip", () => {
    test("roundtrips simple selection", () => {
      container.textContent = "The quick brown fox jumps over the lazy dog";
      const textNode = container.firstChild as Text;

      const originalRange = document.createRange();
      originalRange.setStart(textNode, 4);
      originalRange.setEnd(textNode, 9);
      expect(originalRange.toString()).toBe("quick");

      const position = fromRange(container, originalRange);
      const restoredRange = toRange(container, position.start, position.end);

      expect(restoredRange?.toString()).toBe("quick");
    });

    test("roundtrips cross-element selection", () => {
      container.innerHTML = "Hello <strong>beautiful</strong> world";

      // Select "lo beautiful wo"
      const helloNode = container.firstChild as Text;
      const worldNode = container.lastChild as Text;

      const originalRange = document.createRange();
      originalRange.setStart(helloNode, 3);
      originalRange.setEnd(worldNode, 3);
      expect(originalRange.toString()).toBe("lo beautiful wo");

      const position = fromRange(container, originalRange);
      const restoredRange = toRange(container, position.start, position.end);

      expect(restoredRange?.toString()).toBe("lo beautiful wo");
    });
  });

  describe("createQuoteSelector", () => {
    test("creates quote with prefix and suffix", () => {
      container.textContent = "The quick brown fox jumps over the lazy dog";

      const quote = createQuoteSelector(container, { start: 16, end: 19 });

      expect(quote.exact).toBe("fox");
      expect(quote.prefix).toBe("The quick brown ");
      expect(quote.suffix).toBe(" jumps over the lazy dog");
    });

    test("handles selection at start of text", () => {
      container.textContent = "Hello world";

      const quote = createQuoteSelector(container, { start: 0, end: 5 });

      expect(quote.exact).toBe("Hello");
      expect(quote.prefix).toBe("");
      expect(quote.suffix).toBe(" world");
    });

    test("handles selection at end of text", () => {
      container.textContent = "Hello world";

      const quote = createQuoteSelector(container, { start: 6, end: 11 });

      expect(quote.exact).toBe("world");
      expect(quote.prefix).toBe("Hello ");
      expect(quote.suffix).toBe("");
    });

    test("truncates long prefix/suffix to 32 chars", () => {
      container.textContent =
        "This is a very long prefix that should be truncated | TARGET | This is a very long suffix that should be truncated";

      const targetStart = container.textContent.indexOf("TARGET");
      const targetEnd = targetStart + 6;

      const quote = createQuoteSelector(container, {
        start: targetStart,
        end: targetEnd,
      });

      expect(quote.exact).toBe("TARGET");
      expect(quote.prefix.length).toBe(32);
      expect(quote.suffix.length).toBe(32);
    });
  });

  describe("createAnchor", () => {
    test("creates anchor with position and quote", () => {
      container.textContent = "Hello world, this is a test";
      const textNode = container.firstChild as Text;

      const range = document.createRange();
      range.setStart(textNode, 6);
      range.setEnd(textNode, 11);

      const anchor = createAnchor(container, range);

      expect(anchor.position).toEqual({ start: 6, end: 11 });
      expect(anchor.quote.exact).toBe("world");
      expect(anchor.quote.prefix).toBe("Hello ");
      expect(anchor.quote.suffix).toBe(", this is a test");
    });
  });

  describe("wrapRangeWithHighlight", () => {
    test("wraps simple text selection", () => {
      container.textContent = "Hello world";

      const range = toRange(container, 6, 11);
      if (!range) throw new Error("Expected range to be non-null in test");
      const marks = wrapRangeWithHighlight(range, "test-id", "highlight");

      expect(marks).toHaveLength(1);
      expect(marks[0].tagName).toBe("MARK");
      expect(marks[0].textContent).toBe("world");
      expect(marks[0].dataset.highlightId).toBe("test-id");
      expect(marks[0].className).toBe("highlight");
      expect(container.innerHTML).toBe(
        'Hello <mark data-highlight-id="test-id" class="highlight">world</mark>',
      );
    });

    test("wraps partial text within element", () => {
      container.innerHTML = "<p>Hello world</p>";

      const p = container.querySelector("p");
      if (!p) throw new Error("Expected p element to be non-null in test");
      const range = toRange(p, 0, 5);
      if (!range) throw new Error("Expected range to be non-null in test");
      const marks = wrapRangeWithHighlight(range, "partial", "hl");

      expect(marks).toHaveLength(1);
      expect(marks[0].textContent).toBe("Hello");
      expect(p.innerHTML).toBe(
        '<mark data-highlight-id="partial" class="hl">Hello</mark> world',
      );
    });

    test("wraps selection spanning multiple elements", () => {
      container.innerHTML = "Start <strong>middle</strong> end";

      // Select "art middle en" (across three text nodes)
      const range = toRange(container, 2, 15);
      if (!range) throw new Error("Expected range to be non-null in test");
      const marks = wrapRangeWithHighlight(range, "cross", "hl");

      expect(marks).toHaveLength(3);
      expect(marks[0].textContent).toBe("art ");
      expect(marks[1].textContent).toBe("middle");
      expect(marks[2].textContent).toBe(" en");

      // All marks should have same ID
      for (const mark of marks) {
        expect(mark.dataset.highlightId).toBe("cross");
      }
    });

    test("preserves surrounding text when wrapping", () => {
      container.textContent = "prefix TARGET suffix";

      const range = toRange(container, 7, 13);
      if (!range) throw new Error("Expected range to be non-null in test");
      wrapRangeWithHighlight(range, "id", "hl");

      expect(container.textContent).toBe("prefix TARGET suffix");
      expect(container.innerHTML).toBe(
        'prefix <mark data-highlight-id="id" class="hl">TARGET</mark> suffix',
      );
    });

    test("handles selection at text node boundaries", () => {
      container.innerHTML = "<em>italic</em><strong>bold</strong>";

      // Select just "bold"
      const range = toRange(container, 6, 10);
      if (!range) throw new Error("Expected range to be non-null in test");
      const marks = wrapRangeWithHighlight(range, "boundary", "hl");

      expect(marks).toHaveLength(1);
      expect(marks[0].textContent).toBe("bold");
    });
  });
});
