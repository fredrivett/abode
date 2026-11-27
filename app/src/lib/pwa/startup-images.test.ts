import { describe, expect, it } from "vitest";
import { STARTUP_IMAGES } from "./startup-images";

describe("STARTUP_IMAGES", () => {
  it("gives every device, orientation and scheme exactly one image", () => {
    // iOS uses the first match, so a duplicate query leaves an image unused
    const media = STARTUP_IMAGES.map((image) => image.media);
    expect(new Set(media).size).toBe(media.length);
    const names = STARTUP_IMAGES.map((image) => image.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("sizes each image to the screen as held", () => {
    const portrait = STARTUP_IMAGES.find((image) =>
      image.media.startsWith("(device-width: 390px)"),
    );
    const landscape = STARTUP_IMAGES.find(
      (image) =>
        image.media.startsWith("(device-width: 390px)") &&
        image.media.includes("landscape"),
    );
    // iPhone 14: 390×844pt at 3x
    expect(portrait).toMatchObject({ width: 1170, height: 2532 });
    expect(landscape).toMatchObject({ width: 2532, height: 1170 });
  });
});
