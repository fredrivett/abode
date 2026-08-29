import type { ReactElement } from "react";
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { linkifyBio } from "./linkify-bio";

type LinkProps = {
  href: string;
  target: string;
  rel: string;
  children: string;
};

function asLink(node: unknown): ReactElement<LinkProps> {
  if (!isValidElement(node)) throw new Error("Expected a React element");
  return node as ReactElement<LinkProps>;
}

describe("linkifyBio", () => {
  describe("plain text (no linkable URLs)", () => {
    it("returns text with no https URL untouched", () => {
      const result = linkifyBio("Just a normal bio, nothing to link.");
      expect(result).toEqual(["Just a normal bio, nothing to link."]);
    });

    it("returns an empty array for an empty string", () => {
      expect(linkifyBio("")).toEqual([]);
    });

    it("leaves bare domains as plain text", () => {
      // Bare domains are the user's opt-out: only explicit https links link.
      const result = linkifyBio("abode.fyi by night, fredrivett.com by day");
      expect(result).toEqual(["abode.fyi by night, fredrivett.com by day"]);
    });

    it("preserves newlines", () => {
      const text = "Line 1\nLine 2\n\nLine 4";
      expect(linkifyBio(text)).toEqual([text]);
    });
  });

  describe("single https URL", () => {
    it("links the URL and displays only the hostname", () => {
      const result = linkifyBio("🏡 https://abode.fyi by night");
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("🏡 ");
      const link = asLink(result[1]);
      expect(link.props.href).toBe("https://abode.fyi");
      expect(link.props.children).toBe("abode.fyi");
      expect(link.props.target).toBe("_blank");
      expect(link.props.rel).toBe("noopener noreferrer nofollow");
      expect(result[2]).toBe(" by night");
    });

    it("keeps the full path in href but shows just the hostname", () => {
      const result = linkifyBio("writing https://fredrivett.com/blog/post");
      const link = asLink(result[1]);
      expect(link.props.href).toBe("https://fredrivett.com/blog/post");
      expect(link.props.children).toBe("fredrivett.com");
    });

    it("links http as well as https", () => {
      const result = linkifyBio("see http://example.com");
      expect(asLink(result[1]).props.href).toBe("http://example.com");
    });

    it("preserves a www. subdomain in the display, matching the website pill", () => {
      const result = linkifyBio("https://www.example.com");
      expect(asLink(result[0]).props.children).toBe("www.example.com");
    });
  });

  describe("trailing punctuation", () => {
    it("excludes a trailing period from the link and keeps it as text", () => {
      const result = linkifyBio("home at https://abode.fyi.");
      expect(result).toHaveLength(3);
      const link = asLink(result[1]);
      expect(link.props.href).toBe("https://abode.fyi");
      expect(link.props.children).toBe("abode.fyi");
      expect(result[2]).toBe(".");
    });

    it("excludes a wrapping paren/comma", () => {
      const result = linkifyBio("(https://abode.fyi), then more");
      expect(result[0]).toBe("(");
      expect(asLink(result[1]).props.href).toBe("https://abode.fyi");
      // The peeled punctuation and the following text are adjacent text nodes
      expect(result[2]).toBe("),");
      expect(result[3]).toBe(" then more");
    });

    it("keeps a balanced closing paren that is part of the path", () => {
      const url = "https://en.wikipedia.org/wiki/Foo_(bar)";
      const result = linkifyBio(`see ${url}`);
      expect(result).toHaveLength(2);
      expect(asLink(result[1]).props.href).toBe(url);
    });

    it("keeps a balanced paren but still peels a trailing period", () => {
      const url = "https://en.wikipedia.org/wiki/Foo_(bar)";
      const result = linkifyBio(`see ${url}.`);
      expect(asLink(result[1]).props.href).toBe(url);
      expect(result[2]).toBe(".");
    });
  });

  describe("multiple URLs", () => {
    it("links each URL independently", () => {
      const result = linkifyBio(
        "day https://superhuman.com night https://abode.fyi",
      );
      expect(result).toHaveLength(4);
      expect(result[0]).toBe("day ");
      expect(asLink(result[1]).props.href).toBe("https://superhuman.com");
      expect(result[2]).toBe(" night ");
      expect(asLink(result[3]).props.href).toBe("https://abode.fyi");
    });
  });
});
