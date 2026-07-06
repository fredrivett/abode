import { describe, expect, it } from "vitest";
import {
  extractProductImageKeys,
  filesToRemove,
  getItemStorageBytes,
} from "./item-storage";

describe("getItemStorageBytes", () => {
  it("counts an uploaded image's size", () => {
    expect(getItemStorageBytes({ size: 1234 })).toBe(BigInt(1234));
  });

  it("counts a cover's size", () => {
    expect(getItemStorageBytes({ coverSize: 5000 })).toBe(BigInt(5000));
  });

  it("sums size and coverSize", () => {
    expect(getItemStorageBytes({ size: 100, coverSize: 900 })).toBe(
      BigInt(1000),
    );
  });

  it("ignores non-positive or non-numeric values", () => {
    expect(getItemStorageBytes({ size: 0, coverSize: -5 })).toBe(BigInt(0));
    expect(getItemStorageBytes({ size: "big" })).toBe(BigInt(0));
    expect(getItemStorageBytes(null)).toBe(BigInt(0));
    expect(getItemStorageBytes(undefined)).toBe(BigInt(0));
  });

  it("floors fractional byte counts", () => {
    expect(getItemStorageBytes({ size: 10.9 })).toBe(BigInt(10));
  });
});

describe("extractProductImageKeys", () => {
  it("pulls fileKeys from the images array", () => {
    const images = [
      { fileKey: "u/a.jpg", url: "https://x/a" },
      { fileKey: "u/b.jpg", url: "https://x/b" },
    ];
    expect(extractProductImageKeys(images)).toEqual(["u/a.jpg", "u/b.jpg"]);
  });

  it("skips entries without a usable fileKey", () => {
    const images = [{ fileKey: "u/a.jpg" }, { url: "no-key" }, { fileKey: "" }];
    expect(extractProductImageKeys(images)).toEqual(["u/a.jpg"]);
  });

  it("returns empty for null/non-array input", () => {
    expect(extractProductImageKeys(null)).toEqual([]);
    expect(extractProductImageKeys(undefined)).toEqual([]);
    expect(extractProductImageKeys("nope")).toEqual([]);
  });
});

describe("filesToRemove", () => {
  it("removes all previous keys when nothing is reused", () => {
    expect(filesToRemove(["a", "b"], [])).toEqual(["a", "b"]);
  });

  it("keeps a key still in use by the new data", () => {
    // A cover re-selected under the same key must not be deleted
    expect(filesToRemove(["cover", "old"], ["cover"])).toEqual(["old"]);
  });

  it("de-duplicates repeated old keys", () => {
    expect(filesToRemove(["a", "a", "b"], [])).toEqual(["a", "b"]);
  });

  it("returns empty when every old key is still in use", () => {
    expect(filesToRemove(["a", "b"], ["a", "b"])).toEqual([]);
  });
});
