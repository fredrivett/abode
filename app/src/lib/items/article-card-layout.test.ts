import { describe, expect, it } from "vitest";
import {
  articleBylineParts,
  articleCoverAspect,
  articleTeaser,
  displayDomain,
  estimateArticleCaptionHeight,
} from "./article-card-layout";

// Every character 8px wide: deterministic wrapping
const CONTEXT = {
  columnWidthPx: 200,
  cardRootPx: 16,
  rootRemPx: 16,
  measure: (text: string) => text.length * 8,
};

describe("displayDomain", () => {
  it("drops a leading www but keeps other subdomains", () => {
    expect(displayDomain("www.asteriskmag.com")).toBe("asteriskmag.com");
    expect(displayDomain("blog.example.com")).toBe("blog.example.com");
    expect(displayDomain(null)).toBeNull();
  });
});

describe("articleBylineParts", () => {
  it("reads who · when · how long, author first", () => {
    expect(
      articleBylineParts({
        author: "Alex Danco",
        domain: "www.alexdanco.com",
        publishedAt: "2026-01-15T00:00:00.000Z",
        readingTime: 9,
      }),
    ).toEqual(["Alex Danco", "Jan 15, 2026", "9 min read"]);
  });

  it("falls back to the www-less domain and drops missing parts", () => {
    expect(
      articleBylineParts({ author: " ", domain: "www.example.com" }),
    ).toEqual(["example.com"]);
  });
});

describe("articleTeaser", () => {
  it("prefers the publisher description", () => {
    expect(
      articleTeaser({
        title: "T",
        description: "  A  short   summary ",
        content: "A long first paragraph of the article that is prose.",
      }),
    ).toBe("A short summary");
  });

  it("skips a description that only repeats the title", () => {
    expect(
      articleTeaser({
        title: "What Shall I Teach My Son?",
        description: "what shall i teach my son?",
        content: null,
      }),
    ).toBeNull();
  });

  it("falls back to the first prose paragraph, skipping headings, images and kickers", () => {
    expect(
      articleTeaser({
        title: "T",
        content: [
          "# Heading",
          "![cover](https://example.com/a.png)",
          "By Clara Collier",
          "What is the purpose of an *education*, and what should a [parent](https://x.y) pass on?",
        ].join("\n\n"),
      }),
    ).toBe(
      "What is the purpose of an education, and what should a parent pass on?",
    );
  });

  it("returns null when nothing reads as prose", () => {
    expect(articleTeaser({ title: "T", content: "- a\n- b" })).toBeNull();
  });
});

describe("articleCoverAspect", () => {
  it("uses stored dims, clamped", () => {
    expect(articleCoverAspect({ coverWidth: 1200, coverHeight: 800 })).toBe(
      1.5,
    );
    expect(articleCoverAspect({ coverWidth: 3000, coverHeight: 500 })).toBe(2);
    expect(articleCoverAspect({ coverWidth: 500, coverHeight: 2000 })).toBe(
      0.8,
    );
  });

  it("assumes an og:image shape without dims", () => {
    expect(articleCoverAspect(null)).toBe(1.91);
  });
});

describe("estimateArticleCaptionHeight", () => {
  const base = { title: "Title", teaser: null, bylineParts: [] };

  it("caps the title at three lines", () => {
    const long = estimateArticleCaptionHeight(
      { ...base, title: "word ".repeat(80) },
      CONTEXT,
    );
    const veryLong = estimateArticleCaptionHeight(
      { ...base, title: "word ".repeat(200) },
      CONTEXT,
    );
    expect(veryLong).toBe(long);
  });

  it("wraps the byline between parts, up to two rows", () => {
    const one = estimateArticleCaptionHeight(
      { ...base, bylineParts: ["a.com"] },
      CONTEXT,
    );
    const two = estimateArticleCaptionHeight(
      { ...base, bylineParts: ["Alex Danco", "Jan 15, 2026", "9 min read"] },
      CONTEXT,
    );
    const capped = estimateArticleCaptionHeight(
      {
        ...base,
        bylineParts: [
          "Alex Danco",
          "Jan 15, 2026",
          "9 min read",
          "x".repeat(30),
        ],
      },
      CONTEXT,
    );
    // Byline line is max(0.75rem, 0.875em) × 1.5 = 21px
    expect(two - one).toBe(21);
    expect(capped).toBe(two);
  });
});
