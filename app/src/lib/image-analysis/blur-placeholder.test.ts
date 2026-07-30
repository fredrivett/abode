import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { generateBlurDataUrl } from "./blur-placeholder";

describe("generateBlurDataUrl", () => {
  it("returns a tiny webp data URL for a valid image", async () => {
    const png = await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 3,
        background: { r: 200, g: 60, b: 40 },
      },
    })
      .png()
      .toBuffer();

    const result = await generateBlurDataUrl(png);

    expect(result).toMatch(/^data:image\/webp;base64,/);
    // Must stay small — it ships inline in the items payload
    expect(result?.length ?? Infinity).toBeLessThan(3000);
  });

  it("returns null for bytes that can't be decoded", async () => {
    const result = await generateBlurDataUrl(Buffer.from("not an image"));
    expect(result).toBeNull();
  });
});
