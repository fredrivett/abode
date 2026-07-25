import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyItemKind } from "./classify-item-kind";
import { extractReadableSignals } from "./readable-signals";

/**
 * End-to-end article-vs-webpage classification against saved copies of real
 * pages. Wires the actual Readability signal extractor into the pure classifier,
 * so these exercise the full decision (publisher metadata + prose fingerprint) —
 * not synthetic word counts. Covers the two failure modes a naive word-count or
 * a lone `isProbablyReaderable` check both get wrong:
 *   - content-rich homepages / link hubs that are NOT articles
 *   - metadata-less long-form essays that ARE articles
 */
const CASES = [
  // Non-articles
  {
    file: "article-fredrivett-homepage.html",
    url: "https://www.fredrivett.com/",
    expected: "webpage",
  },
  {
    file: "article-paulgraham-homepage.html",
    url: "https://paulgraham.com/",
    expected: "webpage",
  },
  {
    file: "article-every-homepage.html",
    url: "https://every.to/",
    expected: "webpage",
  },
  {
    file: "article-every-about.html",
    url: "https://every.to/about",
    expected: "webpage",
  },
  // Articles
  {
    file: "article-fredrivett-blog-post.html",
    url: "https://www.fredrivett.com/2025/09/10/becoming-the-person-who-does-the-thing/",
    expected: "article",
  },
  {
    file: "article-paulgraham-essay.html",
    url: "https://paulgraham.com/kids.html",
    expected: "article",
  },
  {
    file: "article-every-post.html",
    url: "https://every.to/chain-of-thought/how-gpt-5-6-changes-knowledge-work",
    expected: "article",
  },
] as const;

describe("classifyItemKind — real article vs webpage fixtures", () => {
  for (const { file, url, expected } of CASES) {
    it(`classifies ${file} as ${expected}`, () => {
      const html = readFileSync(join(__dirname, "__fixtures__", file), "utf-8");
      const result = classifyItemKind({
        url,
        resolvedUrl: url,
        contentType: "text/html",
        html,
        getArticleSignals: () => {
          const s = extractReadableSignals(html, url);
          return {
            wordCount: s.wordCount,
            linkDensity: s.linkDensity,
            longestParagraphWords: s.longestParagraphWords,
          };
        },
      });
      expect(result?.kind).toBe(expected);
    });
  }
});
