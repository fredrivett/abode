import type { FilterType } from "@/lib/search/types";

// A demo token is either plain typed text (fuzzy, semantic) or a grounded facet
// value that pops into a chip on "space" — mirroring the real search bar, where
// chips are grounded facets and free text is semantic. See detect-suggestions.ts.
export type DemoToken =
  | { kind: "text"; text: string }
  | { kind: "chip"; facet: FilterType; value: string };

export type DemoSearch = {
  tokens: DemoToken[];
  /**
   * Ids of the GALLERY_CARDS this search surfaces — brightened + lifted while
   * the query holds. Chip (grounded) values are truthful to each card's insight
   * (enforced by demo-searches.test.ts); free text may reach semantically.
   */
  matchIds: string[];
};

// The rotating homepage demo. Each search showcases a different capability and
// points at real cards on the page: colour detection, semantic cross-type
// recall, a type + topic filter, and location + date chips.
export const DEMO_SEARCHES: DemoSearch[] = [
  // colour + object — abode saw the palette and what's in the shot
  {
    tokens: [
      { kind: "chip", facet: "color", value: "blue" },
      { kind: "chip", facet: "object", value: "computer" },
    ],
    matchIds: ["imac-g3"],
  },
  // semantic, cross-type — one plain word, a video and a product
  {
    tokens: [{ kind: "text", text: "vinyl" }],
    matchIds: ["tiny-desk", "turntable"],
  },
  // type + topic
  {
    tokens: [
      // real ItemKind is "article"; shown plural (label-less) so it reads naturally
      { kind: "chip", facet: "type", value: "articles" },
      { kind: "text", text: "on" },
      { kind: "chip", facet: "tag", value: "startups" },
    ],
    matchIds: ["start-a-startup"],
  },
  // location + date chips
  {
    tokens: [
      { kind: "chip", facet: "location", value: "london" },
      { kind: "chip", facet: "date", value: "2024" },
    ],
    matchIds: ["red-arch", "city-sunset"],
  },
];
