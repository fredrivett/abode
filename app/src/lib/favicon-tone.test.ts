import { describe, expect, it } from "vitest";
import { faviconTone } from "./favicon-tone";

type Rgba = [number, number, number, number];

/** A 100-pixel icon: the given runs of pixels, transparent for the rest */
function icon(...runs: { count: number; rgba: Rgba }[]): number[] {
  const pixels = runs.flatMap(({ count, rgba }) =>
    Array.from({ length: count }, () => rgba),
  );
  const blank = Array.from(
    { length: 100 - pixels.length },
    (): Rgba => [0, 0, 0, 0],
  );
  return [...pixels, ...blank].flat();
}

describe("faviconTone", () => {
  it("flags sparse dark ink, which vanishes on the dark card", () => {
    expect(faviconTone(icon({ count: 22, rgba: [20, 20, 20, 255] }))).toBe(
      "dark",
    );
  });

  it("flags sparse light ink, which vanishes on the light card", () => {
    expect(faviconTone(icon({ count: 22, rgba: [255, 255, 255, 255] }))).toBe(
      "light",
    );
  });

  it("leaves mid-grey ink bare: it contrasts with both cards", () => {
    expect(
      faviconTone(icon({ count: 22, rgba: [128, 128, 128, 255] })),
    ).toBeNull();
  });

  it("leaves an icon with its own tile bare, however dark", () => {
    expect(
      faviconTone(icon({ count: 90, rgba: [20, 20, 20, 255] })),
    ).toBeNull();
  });

  it("measures perceived luminance, not the channel average", () => {
    // Pure green is a dark grey by channel average but light by luminance
    expect(faviconTone(icon({ count: 22, rgba: [0, 255, 0, 255] }))).toBe(
      "light",
    );
  });

  it("weights ink by alpha, so faint edges don't outvote solid strokes", () => {
    expect(
      faviconTone(
        icon(
          { count: 10, rgba: [0, 0, 0, 255] },
          { count: 40, rgba: [255, 255, 255, 13] },
        ),
      ),
    ).toBe("dark");
  });

  it("has no tone for a blank icon", () => {
    expect(faviconTone(icon())).toBeNull();
  });
});
