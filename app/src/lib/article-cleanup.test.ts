import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  cleanArticleDocument,
  flattenFigcaptions,
  tidySectionBreaks,
} from "./article-cleanup";
import { extractReadableSignals } from "./readable-signals";

const PROSE = "word ".repeat(80).trim();

function documentFor(bodyHtml: string): Document {
  return new JSDOM(`<body>${bodyHtml}</body>`).window.document;
}

function readFixture(file: string): string {
  return readFileSync(join(__dirname, "__fixtures__", file), "utf-8");
}

describe("cleanArticleDocument — clutter blocks", () => {
  it("removes a block whose class names a clutter pattern", () => {
    const document = documentFor(
      `<p>${PROSE}</p><div class="block read-more"><a href="/x">Other story</a></div>`,
    );
    const report = cleanArticleDocument(document);
    expect(report.removedBlocks).toEqual(["block read-more"]);
    expect(document.body.textContent).not.toContain("Other story");
  });

  it("matches whole class-name segments, including BEM elements and modifiers", () => {
    const document = documentFor(
      `<p>${PROSE}</p>
       <div class="read-more__title">A</div>
       <div class="newsletter--inline">B</div>
       <div class="spread-moreish">C</div>
       <div class="adapter">D</div>`,
    );
    const { removedBlocks } = cleanArticleDocument(document);
    expect(removedBlocks).toEqual(["read-more__title", "newsletter--inline"]);
    expect(document.body.textContent).toContain("C");
    expect(document.body.textContent).toContain("D");
  });

  it("keeps a matched block that contains a prose paragraph", () => {
    const document = documentFor(
      `<p>${PROSE}</p><p>${PROSE}</p><p>${PROSE}</p><div class="related"><p>${PROSE}</p></div>`,
    );
    expect(cleanArticleDocument(document).removedBlocks).toEqual([]);
  });

  it("keeps a matched wrapper holding a large share of the page's text", () => {
    const short = "a short line of text";
    const document = documentFor(
      `<div class="related-content-wrapper">${`<p>${short}</p>`.repeat(10)}</div><p>${short}</p>`,
    );
    expect(cleanArticleDocument(document).removedBlocks).toEqual([]);
  });

  it("never removes the article wrapper or a block containing it", () => {
    const document = documentFor(
      `<div class="share-layout"><article class="promo-article"><p>short</p></article></div>`,
    );
    expect(cleanArticleDocument(document).removedBlocks).toEqual([]);
  });

  it("never removes a clutter-classed articleBody wrapper", () => {
    const document = documentFor(
      `<div class="share-wrap" itemprop="articleBody"><p>short</p></div>`,
    );
    expect(cleanArticleDocument(document).removedBlocks).toEqual([]);
  });

  it("keeps a matched block holding a preserved tweet marker", () => {
    const document = documentFor(
      `<p>${PROSE}</p><div class="share-embed"><p data-embed-type="twitter">[[TWEET:123]]</p></div>`,
    );
    expect(cleanArticleDocument(document).removedBlocks).toEqual([]);
  });
});

describe("cleanArticleDocument — section dividers", () => {
  it("turns an empty or SVG-only divider block into an <hr>", () => {
    const document = documentFor(
      `<div class="divider"><div class="divider__line"></div></div>
       <div class="section-break"><svg><path d="M0 0" /></svg></div>
       <div role="separator"></div>`,
    );
    expect(cleanArticleDocument(document).dividers).toBe(3);
    expect(document.body.querySelectorAll("hr")).toHaveLength(3);
  });

  it("turns an asterism paragraph into an <hr>", () => {
    const document = documentFor(
      "<p>* * *</p><p>***</p><p>⁂</p><p>* not a break</p>",
    );
    expect(cleanArticleDocument(document).dividers).toBe(3);
    expect(document.body.textContent).toContain("* not a break");
  });

  it("leaves a divider-classed block alone when it has text or media", () => {
    const document = documentFor(
      `<div class="divider">Chapter two</div><div class="separator"><img src="a.jpg" /></div><img class="divider" src="b.png" />`,
    );
    expect(cleanArticleDocument(document).dividers).toBe(0);
  });

  it("doesn't convert a divider inside a removed clutter block", () => {
    const document = documentFor(
      `<p>${PROSE}</p><div class="subscribe-cta"><p>Subscribe</p><div class="divider"></div></div>`,
    );
    const report = cleanArticleDocument(document);
    expect(report.removedBlocks).toEqual(["subscribe-cta"]);
    expect(report.dividers).toBe(0);
  });
});

describe("cleanArticleDocument — captions", () => {
  it("turns the outermost classed caption into a <figcaption>", () => {
    const document = documentFor(
      `<div class="single-image__caption"><div class="single-image__caption-short"><p>PHOTO BY X</p></div></div>`,
    );
    expect(cleanArticleDocument(document).captions).toBe(1);
    expect(document.querySelectorAll("figcaption")).toHaveLength(1);
    expect(document.querySelector("figcaption")?.textContent).toContain(
      "PHOTO BY X",
    );
  });

  it("leaves captions with media, long text or an existing figcaption alone", () => {
    const document = documentFor(
      `<div class="caption"><img src="a.jpg" /></div>
       <div class="wp-caption-text">${PROSE}</div>
       <figure><figcaption class="caption">Already one</figcaption></figure>`,
    );
    expect(cleanArticleDocument(document).captions).toBe(0);
  });
});

describe("flattenFigcaptions", () => {
  it("unwraps block children into one inline run", () => {
    const { body } = documentFor(
      `<figcaption><div><p>Photo by <a href="/x">X</a></p></div><p>Courtesy Y</p></figcaption>`,
    );
    flattenFigcaptions(body);
    expect(body.innerHTML).toBe(
      '<figcaption>Photo by <a href="/x">X</a> Courtesy Y</figcaption>',
    );
  });
});

describe("tidySectionBreaks", () => {
  it("drops leading, trailing and back-to-back breaks", () => {
    expect(
      tidySectionBreaks("* * *\n\nOne\n\n* * *\n\n* * *\n\nTwo\n\n* * *"),
    ).toBe("One\n\n* * *\n\nTwo");
  });

  it("leaves breaks that separate content untouched", () => {
    const markdown = "One\n\n* * *\n\nTwo\n\n* * *\n\nThree";
    expect(tidySectionBreaks(markdown)).toBe(markdown);
  });
});

describe("extractReadableSignals — sectioned magazine fixture", () => {
  const markdown =
    extractReadableSignals(
      readFixture("article-sectioned-magazine.html"),
      "https://magazine.example.com/article/the-long-feature/",
    ).articleContent ?? "";

  it("drops in-body clutter", () => {
    for (const clutter of [
      "Read More",
      "Another Story Entirely",
      "Listen on",
      "Subscribe",
      "sponsor-banner",
      "newsletter",
    ]) {
      expect(markdown).not.toContain(clutter);
    }
  });

  it("keeps every body paragraph, including one between two clutter blocks", () => {
    expect(markdown).toContain("he opening line.");
    expect(markdown).toContain("The second section");
    expect(markdown).toContain("must survive cleanup intact");
    expect(markdown).toContain("The third section");
    expect(markdown).toContain("A closing coda");
  });

  it("separates sections with breaks, with none dangling at either end", () => {
    expect(markdown.match(/^\* \* \*$/gm)).toHaveLength(3);
    expect(markdown).toMatch(/\* \* \*\n\n\*\*The second section\*\*/);
    expect(markdown).toMatch(/\* \* \*\n\n\*\*The third section\*\*/);
    expect(markdown.startsWith("* * *")).toBe(false);
    expect(markdown.trimEnd().endsWith("* * *")).toBe(false);
  });

  it("keeps the photo caption as a figcaption", () => {
    expect(markdown).toContain(
      "<figcaption>PHOTO BY A PHOTOGRAPHER</figcaption>",
    );
  });
});

describe("cleanArticleDocument — real article fixtures", () => {
  // Real article pages must come through untouched: a failure here means a
  // pattern or guard is now eating content it shouldn't
  for (const file of [
    "article-fredrivett-blog-post.html",
    "article-paulgraham-essay.html",
    "article-every-post.html",
  ]) {
    it(`leaves ${file} unchanged`, () => {
      const document = new JSDOM(readFixture(file)).window.document;
      expect(cleanArticleDocument(document)).toEqual({
        removedBlocks: [],
        dividers: 0,
        captions: 0,
      });
    });
  }
});
