import { describe, expect, it } from "vitest";
import { DEMO_SEARCHES } from "./demo-searches";
import { buildFrames } from "./search-demo";

// The cards surfaced once the first value of each query is fully typed. Order
// follows GALLERY_CARDS.
const FIRST_VALUE_MATCHES: Record<number, string[]> = {
  0: ["red-arch", "imac-g3"], // blue
  1: ["tiny-desk", "turntable"], // vinyl
  2: ["start-a-startup"], // articles
  3: ["red-arch", "city-sunset"], // london
};

describe("buildFrames", () => {
  it("fades everything the instant a value appears, then resolves on word-complete", () => {
    DEMO_SEARCHES.forEach((search, i) => {
      const frames = buildFrames(search);

      // First keystroke: a value exists but nothing matches yet → [] (fade all),
      // not the first token's matches (they only resolve once the word is done).
      const firstTyping = frames.find((f) => f.typing.length > 0);
      expect(firstTyping?.typing.length).toBe(1);
      expect(firstTyping?.activeMatchIds).toEqual([]);

      // Once the first value is fully typed, its match resolves.
      const first = search.tokens[0];
      const full = first.kind === "chip" ? first.value : first.text;
      const wordComplete = frames.find((f) => f.typing === full);
      expect(wordComplete?.activeMatchIds).toEqual(FIRST_VALUE_MATCHES[i]);
    });
  });
});
