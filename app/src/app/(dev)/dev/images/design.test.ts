import { describe, expect, it } from "vitest";
import { GALLERY_CARDS } from "@/app/(marketing)/_components/gallery-data";
import {
  defaultCardConfig,
  defaultDesign,
  isValidSlug,
  parseDesign,
  slugForName,
} from "./design";

const X_HEADER = {
  name: "X header",
  format: "x-header",
  width: 1500,
  height: 500,
} as const;

describe("defaultCardConfig", () => {
  it("maps the hero scatter onto the canvas", () => {
    const card = GALLERY_CARDS[0];
    const config = defaultCardConfig(card, { width: 1200, height: 630 });
    expect(config.x).toBe(Math.round(card.scatter.x * 1200));
    expect(config.y).toBe(Math.round(card.scatter.y * 630));
    expect(config.scale).toBe(card.scatter.scale);
  });

  it("swaps transparency for a veil so faded cards stay opaque", () => {
    const faint = GALLERY_CARDS.find((c) => c.scatter.opacity < 0.9);
    const solid = GALLERY_CARDS.find((c) => c.scatter.opacity >= 0.9);
    if (!faint || !solid) throw new Error("fixture cards missing");
    expect(defaultCardConfig(faint, X_HEADER).fade).toBeCloseTo(
      1 - faint.scatter.opacity,
    );
    expect(defaultCardConfig(solid, X_HEADER).fade).toBe(0);
  });

  it("never blurs books", () => {
    const book = GALLERY_CARDS.find((c) => c.kind === "book");
    if (!book) throw new Error("fixture book missing");
    expect(defaultCardConfig(book, X_HEADER).blur).toBe(0);
  });
});

describe("defaultDesign", () => {
  it("matches the homepage hero at the X header reference size", () => {
    const design = defaultDesign(X_HEADER);
    expect(design.headlineSize).toBe(60);
    expect(design.textWidth).toBe(640);
    expect(design.cardWidth).toBe(347);
  });

  it("scales cards down to fit a smaller canvas and keeps text inside it", () => {
    const design = defaultDesign({
      name: "Tiny",
      format: "custom",
      width: 600,
      height: 200,
    });
    expect(design.cardWidth).toBeLessThan(347);
    expect(design.textWidth).toBeLessThanOrEqual(600);
  });

  it("produces a valid design for the smallest possible canvas", () => {
    const design = defaultDesign({
      name: "Pixel",
      format: "custom",
      width: 1,
      height: 1,
    });
    expect(design.cardWidth).toBeGreaterThan(0);
    expect(design.textWidth).toBeGreaterThan(0);
    expect(parseDesign(JSON.stringify(design))).not.toBeNull();
  });

  it("keeps a positive text width on canvases narrower than its margin", () => {
    const design = defaultDesign({
      name: "Sliver",
      format: "custom",
      width: 50,
      height: 50,
    });
    expect(design.textWidth).toBeGreaterThan(0);
    expect(parseDesign(JSON.stringify(design))).not.toBeNull();
  });
});

describe("parseDesign", () => {
  it("rejects malformed input", () => {
    expect(parseDesign("{not json")).toBeNull();
    expect(parseDesign(JSON.stringify({ name: "x" }))).toBeNull();
    expect(
      parseDesign(
        JSON.stringify({ ...defaultDesign(X_HEADER), format: "billboard" }),
      ),
    ).toBeNull();
    for (const field of ["cardWidth", "textWidth"]) {
      expect(
        parseDesign(JSON.stringify({ ...defaultDesign(X_HEADER), [field]: 0 })),
      ).toBeNull();
    }
  });

  it("round-trips a saved design", () => {
    const design = { ...defaultDesign(X_HEADER), headlineSize: 72 };
    design.cards[0] = { ...design.cards[0], visible: false, x: 12 };
    expect(parseDesign(JSON.stringify(design))).toEqual(design);
  });

  it("reconciles cards against the current gallery", () => {
    const design = defaultDesign(X_HEADER);
    const saved = {
      ...design,
      cards: [
        { ...design.cards[1], x: 999 },
        { ...design.cards[0], id: "removed-card" },
      ],
    };
    const parsed = parseDesign(JSON.stringify(saved));
    expect(parsed?.cards.map((c) => c.id)).toEqual(
      GALLERY_CARDS.map((c) => c.id),
    );
    expect(parsed?.cards[1].x).toBe(999);
    expect(parsed?.cards[0]).toEqual(design.cards[0]);
  });
});

describe("slugs", () => {
  it("only accepts filename-safe slugs", () => {
    expect(isValidSlug("x-header")).toBe(true);
    expect(isValidSlug("../secrets")).toBe(false);
    expect(isValidSlug("X Header")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });

  it("derives a unique slug from the name", () => {
    expect(slugForName({ name: "X header!", taken: [] })).toBe("x-header");
    expect(slugForName({ name: "X header", taken: ["x-header"] })).toBe(
      "x-header-2",
    );
    expect(
      slugForName({ name: "X header", taken: ["x-header", "x-header-2"] }),
    ).toBe("x-header-3");
    expect(slugForName({ name: "🙂", taken: [] })).toBe("image");
  });
});
