import { describe, expect, it } from "vitest";
import { imageExtForContentType } from "@/lib/media/rehost-image";

describe("imageExtForContentType", () => {
  it("maps supported raster formats to an extension", () => {
    expect(imageExtForContentType("image/jpeg")).toBe(".jpg");
    expect(imageExtForContentType("image/png")).toBe(".png");
    expect(imageExtForContentType("image/gif")).toBe(".gif");
    expect(imageExtForContentType("image/webp")).toBe(".webp");
  });

  it("ignores charset params and casing", () => {
    expect(imageExtForContentType("IMAGE/JPEG; charset=binary")).toBe(".jpg");
  });

  it("rejects SVG (would be served as same-origin active content)", () => {
    expect(imageExtForContentType("image/svg+xml")).toBeNull();
  });

  it("rejects unknown or empty content-types", () => {
    expect(imageExtForContentType("image/avif")).toBeNull();
    expect(imageExtForContentType("text/html")).toBeNull();
    expect(imageExtForContentType("")).toBeNull();
  });
});
