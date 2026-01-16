import type { ReactElement } from "react";
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { parseTweetText } from "./parse-tweet-text";

type LinkProps = {
  href: string;
  target: string;
  rel: string;
  children: string;
};

describe("parseTweetText", () => {
  describe("plain text (no URLs)", () => {
    it("returns the text as a single string element", () => {
      const result = parseTweetText("Hello, world!");

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("Hello, world!");
    });

    it("handles empty string", () => {
      const result = parseTweetText("");

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("");
    });

    it("preserves whitespace and newlines", () => {
      const text = "Line 1\nLine 2\n\nLine 4";
      const result = parseTweetText(text);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(text);
    });
  });

  describe("text with single URL", () => {
    it("splits text around a URL and creates a link element", () => {
      const result = parseTweetText(
        "Check out https://example.com for more info",
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toBe("Check out ");
      expect(isValidElement(result[1])).toBe(true);
      expect(result[2]).toBe(" for more info");
    });

    it("creates link with correct props", () => {
      const result = parseTweetText("Visit https://example.com/page today");
      const linkElement = result[1] as ReactElement<LinkProps>;

      expect(isValidElement(linkElement)).toBe(true);
      expect(linkElement.props.href).toBe("https://example.com/page");
      expect(linkElement.props.target).toBe("_blank");
      expect(linkElement.props.rel).toBe("noopener noreferrer");
      expect(linkElement.props.children).toBe("https://example.com/page");
    });

    it("handles URL at the start of text", () => {
      const result = parseTweetText("https://example.com is the link");

      // split() includes empty string at start when delimiter is at beginning
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("");
      expect(isValidElement(result[1])).toBe(true);
      expect(result[2]).toBe(" is the link");
    });

    it("handles URL at the end of text", () => {
      const result = parseTweetText("Check this: https://example.com");

      // split() includes empty string at end when delimiter is at end
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("Check this: ");
      expect(isValidElement(result[1])).toBe(true);
      expect(result[2]).toBe("");
    });

    it("handles URL as the only content", () => {
      const result = parseTweetText("https://example.com");

      // split() includes empty strings on both sides
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("");
      expect(isValidElement(result[1])).toBe(true);
      expect(result[2]).toBe("");
    });
  });

  describe("text with multiple URLs", () => {
    it("splits text around multiple URLs", () => {
      const result = parseTweetText(
        "First https://one.com then https://two.com end",
      );

      expect(result).toHaveLength(5);
      expect(result[0]).toBe("First ");
      expect(isValidElement(result[1])).toBe(true);
      expect(result[2]).toBe(" then ");
      expect(isValidElement(result[3])).toBe(true);
      expect(result[4]).toBe(" end");
    });

    it("handles consecutive URLs", () => {
      const result = parseTweetText("https://one.com https://two.com");

      // split() includes empty strings at boundaries
      expect(result).toHaveLength(5);
      expect(result[0]).toBe("");
      expect(isValidElement(result[1])).toBe(true);
      expect(result[2]).toBe(" ");
      expect(isValidElement(result[3])).toBe(true);
      expect(result[4]).toBe("");
    });

    it("each link has correct href", () => {
      const result = parseTweetText("A https://first.com B https://second.com");

      const firstLink = result[1] as ReactElement<LinkProps>;
      const secondLink = result[3] as ReactElement<LinkProps>;

      expect(isValidElement(firstLink)).toBe(true);
      expect(isValidElement(secondLink)).toBe(true);
      expect(firstLink.props.href).toBe("https://first.com");
      expect(secondLink.props.href).toBe("https://second.com");
    });
  });

  describe("URL variations", () => {
    it("handles http URLs", () => {
      const result = parseTweetText("Visit http://example.com");
      const linkElement = result[1] as ReactElement<LinkProps>;

      expect(isValidElement(linkElement)).toBe(true);
      expect(linkElement.props.href).toBe("http://example.com");
    });

    it("handles URLs with paths", () => {
      const result = parseTweetText("Link: https://example.com/path/to/page");
      const linkElement = result[1] as ReactElement<LinkProps>;

      expect(isValidElement(linkElement)).toBe(true);
      expect(linkElement.props.href).toBe("https://example.com/path/to/page");
    });

    it("handles URLs with query parameters", () => {
      const result = parseTweetText(
        "Search: https://example.com/search?q=test&page=1",
      );
      const linkElement = result[1] as ReactElement<LinkProps>;

      expect(isValidElement(linkElement)).toBe(true);
      expect(linkElement.props.href).toBe(
        "https://example.com/search?q=test&page=1",
      );
    });

    it("handles URLs with fragments", () => {
      const result = parseTweetText("Section: https://example.com/page#section");
      const linkElement = result[1] as ReactElement<LinkProps>;

      expect(isValidElement(linkElement)).toBe(true);
      expect(linkElement.props.href).toBe("https://example.com/page#section");
    });

    it("handles t.co shortened URLs", () => {
      const result = parseTweetText("Link: https://t.co/abc123");
      const linkElement = result[1] as ReactElement<LinkProps>;

      expect(isValidElement(linkElement)).toBe(true);
      expect(linkElement.props.href).toBe("https://t.co/abc123");
    });
  });

  describe("edge cases", () => {
    it("does not match URLs without protocol", () => {
      const result = parseTweetText("Visit example.com for more");

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("Visit example.com for more");
    });

    it("handles special characters in surrounding text", () => {
      const result = parseTweetText(
        "Check @user's link: https://example.com #cool",
      );
      const linkElement = result[1] as ReactElement<LinkProps>;

      expect(result).toHaveLength(3);
      expect(result[0]).toBe("Check @user's link: ");
      expect(isValidElement(linkElement)).toBe(true);
      // URL regex captures up to whitespace, so #cool is separate
      expect(linkElement.props.children).toBe("https://example.com");
      expect(result[2]).toBe(" #cool");
    });

    it("handles emoji in text", () => {
      const result = parseTweetText("Great article https://example.com");

      // split() includes empty string at end
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("Great article ");
      expect(isValidElement(result[1])).toBe(true);
      expect(result[2]).toBe("");
    });
  });
});
