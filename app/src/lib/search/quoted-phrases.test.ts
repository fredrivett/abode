import { describe, expect, it } from "vitest";
import {
  findQuotedSpans,
  parseQuotedQuery,
  phraseToPattern,
} from "./quoted-phrases";

describe("findQuotedSpans", () => {
  it("returns each closed quote pair with its position", () => {
    expect(findQuotedSpans('a "b c" d')).toEqual([
      { start: 2, end: 7, phrase: "b c" },
    ]);
  });

  it("accepts curly quotes from phone autocorrect", () => {
    expect(findQuotedSpans("“on the equality”").map((s) => s.phrase)).toEqual([
      "on the equality",
    ]);
  });

  it("ignores an unclosed quote", () => {
    expect(findQuotedSpans('"still typing')).toEqual([]);
  });

  it("only closes a quote with its own glyph", () => {
    expect(findQuotedSpans("“phrase“")).toEqual([]);
    expect(findQuotedSpans('"phrase”')).toEqual([]);
  });

  it("keeps a curly pair nested in straight quotes inside one span", () => {
    expect(findQuotedSpans('"trip “paris”"')).toEqual([
      { start: 0, end: 14, phrase: "trip “paris”" },
    ]);
  });
});

describe("parseQuotedQuery", () => {
  it("extracts phrases and strips quotes from the ranking text", () => {
    expect(parseQuotedQuery('"on the equality of all things"')).toEqual({
      text: "on the equality of all things",
      phrases: ["on the equality of all things"],
    });
  });

  it("handles several phrases alongside plain words", () => {
    expect(parseQuotedQuery('rovelli "all things"  "physics"')).toEqual({
      text: "rovelli all things physics",
      phrases: ["all things", "physics"],
    });
  });

  it("collapses whitespace inside a phrase and drops empty or repeated ones", () => {
    expect(parseQuotedQuery('"  a   b " "" "a b"').phrases).toEqual(["a b"]);
  });

  it("returns no phrases for an unquoted or half-typed query", () => {
    expect(parseQuotedQuery("plain words")).toEqual({
      text: "plain words",
      phrases: [],
    });
    expect(parseQuotedQuery('"half typed')).toEqual({
      text: "half typed",
      phrases: [],
    });
  });
});

describe("phraseToPattern", () => {
  it("allows any whitespace run between words", () => {
    expect(phraseToPattern("all things")).toBe("all\\s+things");
  });

  it("escapes regex metacharacters so they match literally", () => {
    expect(phraseToPattern("c++ (2nd ed.)")).toBe(
      "c\\+\\+\\s+\\(2nd\\s+ed\\.\\)",
    );
    expect(phraseToPattern("a|b [x] ^$ {1} ? * \\")).toBe(
      "a\\|b\\s+\\[x\\]\\s+\\^\\$\\s+\\{1\\}\\s+\\?\\s+\\*\\s+\\\\",
    );
  });
});
