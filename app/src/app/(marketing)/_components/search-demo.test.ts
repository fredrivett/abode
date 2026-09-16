import { describe, expect, it } from "vitest";
import { DEMO_SEARCHES } from "./demo-searches";
import { buildFrames } from "./search-demo";

// The cards surfaced the instant the first character of each query is typed —
// filtering starts on the first keypress, not when the chip commits. Order
// follows GALLERY_CARDS.
const FIRST_KEYPRESS_MATCHES: Record<number, string[]> = {
  0: ["red-arch", "imac-g3"], // [b]lue
  1: ["tiny-desk", "turntable"], // [v]inyl
  2: ["start-a-startup"], // [a]rticles
  3: ["red-arch", "city-sunset"], // [l]ondon
};

describe("buildFrames", () => {
  it("filters from the first typed character of each query", () => {
    DEMO_SEARCHES.forEach((search, i) => {
      const frames = buildFrames(search);
      const firstTyping = frames.find((f) => f.typing.length > 0);
      // the very first keystroke of the query
      expect(firstTyping?.typing.length).toBe(1);
      expect(firstTyping?.activeMatchIds).toEqual(FIRST_KEYPRESS_MATCHES[i]);
    });
  });
});
