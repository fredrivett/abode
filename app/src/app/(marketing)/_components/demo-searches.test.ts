import { describe, expect, it } from "vitest";
import { DEMO_SEARCHES, matchesForTokens } from "./demo-searches";
import { GALLERY_CARDS } from "./gallery-data";

const ids = new Set(GALLERY_CARDS.map((c) => c.id));

// Expected surfaced cards, written out by hand (independent of matchesForTokens /
// cardGroundsChip) so a regression in the grounding logic can't make the
// implementation and its test agree. Order follows GALLERY_CARDS.
// `afterFirstChip` = the set once the first filtering token has committed;
// `final` = the set for the fully-typed query.
const EXPECTED: Record<number, { afterFirstChip: string[]; final: string[] }> =
  {
    // [blue] lights the iMac and the blue-glass building photo, then [computer]
    0: { afterFirstChip: ["red-arch", "imac-g3"], final: ["imac-g3"] },
    // vinyl — curated cross-type set
    1: {
      afterFirstChip: ["tiny-desk", "turntable"],
      final: ["tiny-desk", "turntable"],
    },
    // [articles] on [startups]
    2: { afterFirstChip: ["start-a-startup"], final: ["start-a-startup"] },
    // [london] lights both photos, then [2024] narrows to the 2024 one
    3: { afterFirstChip: ["red-arch", "city-sunset"], final: ["red-arch"] },
  };

// The first token that actually filters (skips a connective word like "on").
const firstFilteringCount = (i: number) =>
  DEMO_SEARCHES[i].tokens.findIndex(
    (t) => t.kind === "chip" || t.matchIds !== undefined,
  ) + 1;

describe("DEMO_SEARCHES", () => {
  it("surfaces exactly the expected cards as each query is built", () => {
    DEMO_SEARCHES.forEach((search, i) => {
      const first = firstFilteringCount(i);
      expect(matchesForTokens(search.tokens.slice(0, first))).toEqual(
        EXPECTED[i].afterFirstChip,
      );
      expect(matchesForTokens(search.tokens)).toEqual(EXPECTED[i].final);
    });
  });

  it("only ever surfaces real gallery cards, never zero mid-query", () => {
    for (const search of DEMO_SEARCHES) {
      for (let n = 1; n <= search.tokens.length; n++) {
        const match = matchesForTokens(search.tokens.slice(0, n));
        // null = nothing filtering committed yet (fine); a set must be non-empty
        if (match === null) continue;
        expect(match.length).toBeGreaterThan(0);
        for (const id of match)
          expect(ids.has(id), `unknown card ${id}`).toBe(true);
      }
    }
  });
});
