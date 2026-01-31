import { describe, expect, it } from "vitest";
import { getFilterTriggerQuery } from "./get-filter-trigger-query";

describe("getFilterTriggerQuery", () => {
  describe("when dropdown is already open (standalone @ without trailing spaces)", () => {
    it("returns null for just @", () => {
      expect(getFilterTriggerQuery("@")).toBeNull();
    });

    it("returns null for text followed by space and @", () => {
      expect(getFilterTriggerQuery("abc @")).toBeNull();
    });
  });

  describe("when cleaning up stale @ with trailing spaces", () => {
    it("cleans up lone @ with trailing space and re-triggers", () => {
      expect(getFilterTriggerQuery("@ ")).toBe("@");
    });

    it("cleans up lone @ with multiple trailing spaces", () => {
      expect(getFilterTriggerQuery("@   ")).toBe("@");
    });

    it("cleans up text + space + @ with trailing space", () => {
      expect(getFilterTriggerQuery("abc @ ")).toBe("abc @");
    });

    it("cleans up text + space + @ with multiple trailing spaces", () => {
      expect(getFilterTriggerQuery("abc @   ")).toBe("abc @");
    });

    it("cleans up and trims extra spaces before the @", () => {
      expect(getFilterTriggerQuery("abc  @ ")).toBe("abc @");
    });
  });

  describe("when inserting new @", () => {
    it("adds @ to empty string", () => {
      expect(getFilterTriggerQuery("")).toBe("@");
    });

    it("adds space + @ to text without trailing space", () => {
      expect(getFilterTriggerQuery("abc")).toBe("abc @");
    });

    it("adds just @ to text with trailing space", () => {
      expect(getFilterTriggerQuery("abc ")).toBe("abc @");
    });

    it("adds space + @ after text ending with @ (not standalone)", () => {
      expect(getFilterTriggerQuery("abc@")).toBe("abc@ @");
    });

    it("adds space + @ after email-like text", () => {
      expect(getFilterTriggerQuery("test@example")).toBe("test@example @");
    });
  });
});
