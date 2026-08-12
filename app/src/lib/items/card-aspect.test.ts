import { describe, expect, it } from "vitest";
import {
  estimateNoteAspect,
  estimateTweetAspect,
  NOTE_ASPECT_BOUNDS,
  type TextMeasurer,
  TWEET_ASPECT_BOUNDS,
} from "./card-aspect";

// Deterministic measurer: width proportional to length × font size. Roughly
// ~2 characters per em, so line-wrapping is predictable in tests.
const measure: TextMeasurer = (text, { px }) => text.length * px * 0.5;

const COL = 250;
const NOTE_CTX = { columnWidthPx: COL, cardRootPx: 16, measure };
const TWEET_CTX = { columnWidthPx: COL, measure };

const noteAspect = (title: string | null, body: string) =>
  estimateNoteAspect({ title, body }, NOTE_CTX);
const tweetAspect = (text: string, hasAvatar = true) =>
  estimateTweetAspect({ text, hasAvatar }, TWEET_CTX);

describe("estimateNoteAspect", () => {
  it("always returns a ratio inside the clamp bounds, quantized", () => {
    for (const body of ["", "hi", "a".repeat(50), "a".repeat(5000)]) {
      const { width, height } = noteAspect(null, body);
      expect(height).toBe(100);
      expect(width).toBeGreaterThanOrEqual(NOTE_ASPECT_BOUNDS.minAspect * 100);
      expect(width).toBeLessThanOrEqual(NOTE_ASPECT_BOUNDS.maxAspect * 100);
      // quantized to 0.05 steps → width is a multiple of 5
      expect(width % 5).toBe(0);
    }
  });

  it("has no min-height: a one-line note is one line tall", () => {
    const empty = noteAspect(null, "").width;
    const oneWord = noteAspect(null, "Groceries").width;
    // one line, whether empty placeholder or a single word → same short card
    expect(empty).toBe(oneWord);
    // far wider/shorter than the old 2.0 floor — proving the floor is gone
    expect(oneWord).toBeGreaterThan(300);
  });

  it("clamps a very long note to the tallest aspect", () => {
    const long = Array.from({ length: 200 }, () => "word".repeat(20)).join(
      "\n",
    );
    expect(noteAspect(null, long).width).toBe(
      NOTE_ASPECT_BOUNDS.minAspect * 100,
    );
  });

  it("scales with the document root font size (accessibility)", () => {
    const body = "a".repeat(100);
    // fontScale 1 → cardRootPx tracks the root rem
    const base = estimateNoteAspect(
      { title: null, body },
      { columnWidthPx: COL, cardRootPx: 16, rootRemPx: 16, measure },
    ).width;
    const large = estimateNoteAspect(
      { title: null, body },
      { columnWidthPx: COL, cardRootPx: 20, rootRemPx: 20, measure },
    ).width;
    // bigger root text → taller card → smaller aspect (narrower width value)
    expect(large).toBeLessThan(base);
  });

  it("grows taller (smaller aspect) as the body grows", () => {
    const short = noteAspect(null, "a".repeat(40)).width;
    const medium = noteAspect(null, "a".repeat(200)).width;
    const long = noteAspect(null, "a".repeat(600)).width;
    expect(short).toBeGreaterThanOrEqual(medium);
    expect(medium).toBeGreaterThanOrEqual(long);
    // ...and the extremes actually differ, not all clamped to one value
    expect(short).toBeGreaterThan(long);
  });

  it("a title adds height (never makes the card shorter)", () => {
    const body = "a".repeat(180);
    const withTitle = noteAspect("A meaningful title", body).width;
    const withoutTitle = noteAspect(null, body).width;
    expect(withTitle).toBeLessThanOrEqual(withoutTitle);
  });

  it("markdown headings are taller than the same text as a paragraph", () => {
    const heading = noteAspect(null, `# ${"a".repeat(120)}`).width;
    const paragraph = noteAspect(null, "a".repeat(120)).width;
    expect(heading).toBeLessThanOrEqual(paragraph);
  });

  it("counts a fenced code block's <pre> padding (short blocks don't clip)", () => {
    // A one-line code block is taller than a one-line paragraph: the <pre> box
    // adds fixed vertical padding on top of the single line.
    const code = noteAspect(null, "```\nx = 1\n```").width;
    const paragraph = noteAspect(null, "x = 1").width;
    expect(code).toBeLessThan(paragraph);
  });

  it("preserves hard-break boundaries instead of collapsing them", () => {
    // Two lines joined by a markdown hard break (trailing spaces) render on
    // separate lines, so the card is taller than the same words soft-wrapped.
    const hardBreaks = noteAspect(
      null,
      "one two  \nthree four  \nfive six",
    ).width;
    const softWrapped = noteAspect(null, "one two three four five six").width;
    expect(hardBreaks).toBeLessThan(softWrapped);
  });

  it("a multi-item list is taller than a single line of the same length", () => {
    const list = noteAspect(null, "- one\n- two\n- three\n- four").width;
    const line = noteAspect(null, "one two three four").width;
    expect(list).toBeLessThanOrEqual(line);
  });
});

describe("estimateTweetAspect", () => {
  it("always returns a ratio inside the clamp bounds, quantized", () => {
    for (const text of ["hi", "word ".repeat(20), "word ".repeat(400)]) {
      const { width, height } = tweetAspect(text);
      expect(height).toBe(100);
      expect(width).toBeGreaterThanOrEqual(TWEET_ASPECT_BOUNDS.minAspect * 100);
      expect(width).toBeLessThanOrEqual(TWEET_ASPECT_BOUNDS.maxAspect * 100);
      expect(width % 5).toBe(0);
    }
  });

  it("has no min-height: a short tweet is a short card", () => {
    const a = tweetAspect("Hello world").width;
    const b = tweetAspect("Hi there").width;
    expect(a).toBe(b); // both one line
    expect(a).toBeGreaterThan(250);
  });

  it("grows taller as the text grows", () => {
    const short = tweetAspect("word ".repeat(5)).width;
    const long = tweetAspect("word ".repeat(60)).width;
    expect(short).toBeGreaterThan(long);
  });

  it("scales with the document root font size (accessibility)", () => {
    const text = "word ".repeat(20);
    const base = estimateTweetAspect(
      { text, hasAvatar: true },
      { columnWidthPx: COL, rootRemPx: 16, measure },
    ).width;
    const large = estimateTweetAspect(
      { text, hasAvatar: true },
      { columnWidthPx: COL, rootRemPx: 20, measure },
    ).width;
    expect(large).toBeLessThan(base);
  });

  it("counts hard newlines as separate lines", () => {
    const wrapped = tweetAspect("a\nb\nc\nd\ne\nf\ng\nh").width;
    const oneLine = tweetAspect("abcdefgh").width;
    expect(wrapped).toBeLessThanOrEqual(oneLine);
  });

  it("an avatar header is never shorter than none", () => {
    const text = "word ".repeat(10);
    expect(tweetAspect(text, true).width).toBeLessThanOrEqual(
      tweetAspect(text, false).width,
    );
  });
});
