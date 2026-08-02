import { describe, expect, it } from "vitest";
import { tweetImageAlt } from "./image-alt";

describe("tweetImageAlt", () => {
  it("uses the author's name when present", () => {
    expect(
      tweetImageAlt({ name: "Cora Meridian", username: "corameridian" }),
    ).toBe("Image from tweet by Cora Meridian");
  });

  it("falls back to @username when there's no name", () => {
    expect(tweetImageAlt({ name: null, username: "corameridian" })).toBe(
      "Image from tweet by @corameridian",
    );
  });

  it("omits the author when neither is known", () => {
    expect(tweetImageAlt({})).toBe("Image from tweet");
  });

  it("adds a 1-based index only when there is more than one image", () => {
    expect(
      tweetImageAlt({ name: "Cora Meridian" }, { index: 0, total: 1 }),
    ).toBe("Image from tweet by Cora Meridian");
    expect(
      tweetImageAlt({ name: "Cora Meridian" }, { index: 1, total: 3 }),
    ).toBe("Image from tweet by Cora Meridian (2 of 3)");
  });
});
