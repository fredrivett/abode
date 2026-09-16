import { describe, expect, it } from "vitest";
import { DEMO_SEARCHES } from "./demo-searches";
import { GALLERY_CARDS, type GalleryCard } from "./gallery-data";

const byId = new Map<string, GalleryCard>(GALLERY_CARDS.map((c) => [c.id, c]));

// Does a card's auto-derived insight genuinely contain this grounded facet
// value? Grounded (chip) facets must be truthful — the same contract the real
// search bar holds; free text is semantic and intentionally not checked here.
function cardGrounds(card: GalleryCard, facet: string, value: string): boolean {
  const { kindLabel, tags, colors, objects, location, date } = card.insight;
  switch (facet) {
    case "type":
      // demo shows the plural, label-less form ("articles"); kind is singular
      return kindLabel === value.replace(/s$/, "");
    case "tag":
      return tags.includes(value);
    case "color":
      return !!colors?.some((c) => c.name === value);
    case "object":
      return !!objects?.includes(value);
    case "location":
      return location === value;
    case "date":
      return !!date?.includes(value);
    default:
      return false;
  }
}

describe("DEMO_SEARCHES", () => {
  it("every search surfaces at least one card", () => {
    for (const search of DEMO_SEARCHES) {
      expect(search.matchIds.length).toBeGreaterThan(0);
    }
  });

  it("every matched id refers to a real gallery card", () => {
    for (const search of DEMO_SEARCHES) {
      for (const id of search.matchIds) {
        expect(byId.has(id), `unknown card id: ${id}`).toBe(true);
      }
    }
  });

  it("chip (grounded) values are truthful to the cards they surface", () => {
    for (const search of DEMO_SEARCHES) {
      for (const token of search.tokens) {
        if (token.kind !== "chip") continue;
        for (const id of search.matchIds) {
          const card = byId.get(id);
          expect(card).toBeDefined();
          if (!card) continue;
          expect(
            cardGrounds(card, token.facet, token.value),
            `card "${id}" should ground ${token.facet}:${token.value}`,
          ).toBe(true);
        }
      }
    }
  });
});
