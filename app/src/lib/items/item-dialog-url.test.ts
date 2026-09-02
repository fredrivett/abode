import { describe, expect, it } from "vitest";
import {
  ITEM_DIALOG_PARAM,
  readItemParam,
  withOpenItem,
  withoutOpenItem,
} from "./item-dialog-url";

describe("item-dialog-url", () => {
  describe("readItemParam", () => {
    it("reads the item id from a query string", () => {
      expect(readItemParam("?item=abc123")).toBe("abc123");
      expect(readItemParam("item=abc123")).toBe("abc123");
    });

    it("returns null when absent", () => {
      expect(readItemParam("?q=cat")).toBeNull();
      expect(readItemParam("")).toBeNull();
    });

    it("accepts a URLSearchParams instance", () => {
      expect(readItemParam(new URLSearchParams("item=xyz"))).toBe("xyz");
    });

    it("normalizes an uppercase UUID to lowercase (canonical) form", () => {
      expect(readItemParam("?item=2C4A9F0E-1B23-4D56-8E90-ABCDEF012345")).toBe(
        "2c4a9f0e-1b23-4d56-8e90-abcdef012345",
      );
    });
  });

  describe("withOpenItem", () => {
    it("adds the item param to an empty query", () => {
      expect(withOpenItem("", "abc")).toBe(`${ITEM_DIALOG_PARAM}=abc`);
    });

    it("preserves existing search and filter params", () => {
      const result = new URLSearchParams(
        withOpenItem("?q=cat&tag=blue", "abc"),
      );
      expect(result.get("q")).toBe("cat");
      expect(result.get("tag")).toBe("blue");
      expect(result.get("item")).toBe("abc");
    });

    it("replaces an existing item param rather than duplicating it", () => {
      const result = new URLSearchParams(withOpenItem("?item=old", "new"));
      expect(result.getAll("item")).toEqual(["new"]);
    });
  });

  describe("withoutOpenItem", () => {
    it("removes only the item param, keeping search/filters", () => {
      const result = new URLSearchParams(
        withoutOpenItem("?q=cat&item=abc&tag=blue"),
      );
      expect(result.get("item")).toBeNull();
      expect(result.get("q")).toBe("cat");
      expect(result.get("tag")).toBe("blue");
    });

    it("returns an empty string when the item was the only param", () => {
      expect(withoutOpenItem("?item=abc")).toBe("");
    });
  });
});
