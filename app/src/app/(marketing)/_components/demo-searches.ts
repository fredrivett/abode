import type { FilterType } from "@/lib/search/types";
import { GALLERY_CARDS, type GalleryCard } from "./gallery-data";

// A demo token is either plain typed text (fuzzy, semantic — optionally carrying
// a curated match set) or a grounded facet value that pops into a chip on
// "space", mirroring the real search bar. See detect-suggestions.ts.
export type DemoToken =
  | { kind: "text"; text: string; matchIds?: string[] }
  | { kind: "chip"; facet: FilterType; value: string };

export type DemoSearch = {
  tokens: DemoToken[];
};

// The rotating homepage demo. Each search showcases a different capability, and
// the gallery filters live as the query is built (see matchesForTokens).
export const DEMO_SEARCHES: DemoSearch[] = [
  // colour + object — [blue] lights the iMac and the blue-glass building shot,
  // then [computer] narrows to the iMac
  {
    tokens: [
      { kind: "chip", facet: "color", value: "blue" },
      { kind: "chip", facet: "object", value: "computer" },
    ],
  },
  // semantic, cross-type — one plain word surfacing a video and a product;
  // curated, since free text isn't grounded against the cards
  {
    tokens: [
      { kind: "text", text: "vinyl", matchIds: ["tiny-desk", "turntable"] },
    ],
  },
  // type + topic
  {
    tokens: [
      // real ItemKind is "article"; shown plural (label-less) so it reads naturally
      { kind: "chip", facet: "type", value: "articles" },
      { kind: "text", text: "on" }, // connective — doesn't filter
      { kind: "chip", facet: "tag", value: "startups" },
    ],
  },
  // location + date — [london] lights both photos, then [2024] narrows to the
  // one captured in 2024 (the other is 2025)
  {
    tokens: [
      { kind: "chip", facet: "location", value: "london" },
      { kind: "chip", facet: "date", value: "2024" },
    ],
  },
];

// Does a card's auto-derived insight genuinely contain this grounded facet
// value? The same contract the real search bar holds — shared by the demo
// runtime and the test so the highlight can never claim an untruthful match.
export function cardGroundsChip(
  card: GalleryCard,
  facet: string,
  value: string,
): boolean {
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

// The cards a single committed token filters to, or null if it doesn't filter
// (a connective word like "on"). Chips ground against the cards; text carries an
// optional curated (semantic) set.
function tokenMatchSet(token: DemoToken): string[] | null {
  if (token.kind === "chip") {
    return GALLERY_CARDS.filter((c) =>
      cardGroundsChip(c, token.facet, token.value),
    ).map((c) => c.id);
  }
  return token.matchIds ?? null;
}

// The cards surfaced by the tokens committed so far — the intersection (AND) of
// each filtering token's set. Returns null while nothing filtering has committed
// yet, so the gallery stays neutral until the first chip/word lands; as chips
// pop in, the set narrows live (progressive filtering).
export function matchesForTokens(committed: DemoToken[]): string[] | null {
  const sets = committed
    .map(tokenMatchSet)
    .filter((s): s is string[] => s !== null);
  if (sets.length === 0) return null;
  return sets.reduce((acc, set) => acc.filter((id) => set.includes(id)));
}
