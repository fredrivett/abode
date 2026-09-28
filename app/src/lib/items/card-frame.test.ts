import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/types/item";
import { getCardFrame } from "./card-frame";

// Minimal items: getCardFrame only reads kind/source/meta/details/title
function item(fields: Record<string, unknown>): Item {
  return {
    id: "i",
    kind: null,
    sourceType: "upload",
    meta: null,
    title: null,
    ...fields,
  } as unknown as Item;
}

const CONTEXT = {
  columnWidth: 250,
  rootRemPx: 16,
  cardRootPx: 16,
  // Every character 8px wide: deterministic wrapping for the text estimators
  measure: (text: string) => text.length * 8,
};

const ratio = ({ width, height }: { width: number; height: number }) =>
  height / width;

describe("getCardFrame", () => {
  it("uses an image's dimensions, or 3:4 without them", () => {
    expect(
      getCardFrame(item({ meta: { width: 800, height: 600 } }), CONTEXT),
    ).toEqual({ width: 800, height: 600 });
    expect(getCardFrame(item({}), CONTEXT)).toEqual({ width: 3, height: 4 });
  });

  it("sizes articles and webpages 4:3", () => {
    expect(getCardFrame(item({ kind: "article" }), CONTEXT)).toEqual({
      width: 4,
      height: 3,
    });
    expect(getCardFrame(item({ kind: "webpage" }), CONTEXT)).toEqual({
      width: 4,
      height: 3,
    });
  });

  it("uses a video's thumbnail dimensions, or 16:9", () => {
    expect(
      getCardFrame(
        item({ kind: "video", meta: { width: 9, height: 16 } }),
        CONTEXT,
      ),
    ).toEqual({ width: 9, height: 16 });
    expect(getCardFrame(item({ kind: "video" }), CONTEXT)).toEqual({
      width: 16,
      height: 9,
    });
  });

  it("uses a tweet's cover media, then its link card, then its text", () => {
    const media = [
      { width: 10, height: 20 },
      { width: 30, height: 40 },
    ];
    expect(
      getCardFrame(
        item({
          kind: "twitter",
          twitterDetails: { media, coverMediaIndex: 1 },
        }),
        CONTEXT,
      ),
    ).toEqual({ width: 30, height: 40 });
    expect(
      getCardFrame(
        item({
          kind: "twitter",
          twitterDetails: { card: { imageUrl: "https://example.com/c.png" } },
        }),
        CONTEXT,
      ),
    ).toEqual({ width: 16, height: 9 });

    const short = getCardFrame(
      item({ kind: "twitter", twitterDetails: { text: "hi" } }),
      CONTEXT,
    );
    const long = getCardFrame(
      item({ kind: "twitter", twitterDetails: { text: "word ".repeat(80) } }),
      CONTEXT,
    );
    expect(ratio(long)).toBeGreaterThan(ratio(short));
  });

  it("sizes a note by its content", () => {
    const short = getCardFrame(
      item({ kind: "note", noteDetails: { content: "hi" } }),
      CONTEXT,
    );
    const long = getCardFrame(
      item({ kind: "note", noteDetails: { content: "word ".repeat(80) } }),
      CONTEXT,
    );
    expect(ratio(long)).toBeGreaterThan(ratio(short));
  });

  it("gives products and Instagram posts their cover's shape, or square", () => {
    expect(
      getCardFrame(
        item({
          kind: "product",
          productDetails: { images: [{ width: 2, height: 3 }] },
        }),
        CONTEXT,
      ),
    ).toEqual({ width: 2, height: 3 });
    expect(getCardFrame(item({ kind: "product" }), CONTEXT)).toEqual({
      width: 1,
      height: 1,
    });
    expect(getCardFrame(item({ kind: "instagram" }), CONTEXT)).toEqual({
      width: 1,
      height: 1,
    });
  });

  it("sizes an unresolved URL from its insert-time hint, or 4:3", () => {
    expect(
      getCardFrame(
        item({
          sourceType: "url",
          meta: { aspectHint: { width: 16, height: 9 } },
        }),
        CONTEXT,
      ),
    ).toMatchObject({ width: 16, height: 9 });
    expect(getCardFrame(item({ sourceType: "url" }), CONTEXT)).toEqual({
      width: 4,
      height: 3,
    });
  });

  it("gives books their padded cover tile", () => {
    const frame = getCardFrame(item({ kind: "book" }), CONTEXT);
    expect(frame.width).toBeGreaterThan(0);
    expect(frame.height).toBeGreaterThan(frame.width);
  });
});
