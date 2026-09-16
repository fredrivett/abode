import { describe, expect, it } from "vitest";
import { DEMO_SEARCHES, matchesForTokens } from "./demo-searches";
import { GALLERY_CARDS } from "./gallery-data";

const ids = new Set(GALLERY_CARDS.map((c) => c.id));

// The set surfaced when the whole query is typed.
const finalMatches = (i: number) =>
  matchesForTokens(DEMO_SEARCHES[i].tokens) ?? [];

describe("DEMO_SEARCHES", () => {
  it("every search surfaces at least one real card when fully typed", () => {
    DEMO_SEARCHES.forEach((_, i) => {
      const match = finalMatches(i);
      expect(match.length, `search ${i} surfaces nothing`).toBeGreaterThan(0);
      for (const id of match) {
        expect(ids.has(id), `search ${i}: unknown card ${id}`).toBe(true);
      }
    });
  });

  it("never narrows to zero mid-query (each committed prefix stays non-empty)", () => {
    for (const [i, search] of DEMO_SEARCHES.entries()) {
      for (let n = 1; n <= search.tokens.length; n++) {
        const match = matchesForTokens(search.tokens.slice(0, n));
        // null = nothing filtering committed yet (fine); a set must be non-empty
        if (match !== null) {
          expect(
            match.length,
            `search ${i} dims to zero after ${n} token(s)`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("filters progressively as chips commit", () => {
    // [blue] lights the iMac and the blue-glass building shot; [computer] narrows
    const blue = matchesForTokens([DEMO_SEARCHES[0].tokens[0]]) ?? [];
    expect(blue).toEqual(expect.arrayContaining(["imac-g3", "red-arch"]));
    expect(finalMatches(0)).toEqual(["imac-g3"]);

    // [london] lights both photos; [2024] narrows to the 2024 one
    const london = matchesForTokens([DEMO_SEARCHES[3].tokens[0]]) ?? [];
    expect(london).toEqual(expect.arrayContaining(["red-arch", "city-sunset"]));
    expect(finalMatches(3)).toEqual(["red-arch"]);
  });

  it("surfaces the curated set for the semantic (free-text) query", () => {
    expect(finalMatches(1)).toEqual(["tiny-desk", "turntable"]);
  });
});
