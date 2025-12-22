import { describe, expect, it } from "vitest";
import { escapeRegex, findNextSlugNumber } from "./room-service";

describe("escapeRegex", () => {
  it("returns string unchanged when no special characters", () => {
    expect(escapeRegex("my-room")).toBe("my-room");
    expect(escapeRegex("simple")).toBe("simple");
    expect(escapeRegex("with-dashes-123")).toBe("with-dashes-123");
  });

  it("escapes dots", () => {
    expect(escapeRegex("my.room")).toBe("my\\.room");
    expect(escapeRegex("v1.0.0")).toBe("v1\\.0\\.0");
  });

  it("escapes asterisks", () => {
    expect(escapeRegex("my*room")).toBe("my\\*room");
  });

  it("escapes plus signs", () => {
    expect(escapeRegex("c++")).toBe("c\\+\\+");
  });

  it("escapes question marks", () => {
    expect(escapeRegex("what?")).toBe("what\\?");
  });

  it("escapes caret and dollar", () => {
    expect(escapeRegex("^start")).toBe("\\^start");
    expect(escapeRegex("end$")).toBe("end\\$");
  });

  it("escapes braces and parentheses", () => {
    expect(escapeRegex("{a}")).toBe("\\{a\\}");
    expect(escapeRegex("(b)")).toBe("\\(b\\)");
  });

  it("escapes pipe", () => {
    expect(escapeRegex("a|b")).toBe("a\\|b");
  });

  it("escapes brackets", () => {
    expect(escapeRegex("[abc]")).toBe("\\[abc\\]");
  });

  it("escapes backslashes", () => {
    expect(escapeRegex("path\\to")).toBe("path\\\\to");
  });

  it("escapes multiple special characters together", () => {
    // Use concatenation to avoid biome warning about template-like string
    const input = "test.*+?^$" + "{}()|[]\\end";
    const expected = "test\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\end";
    expect(escapeRegex(input)).toBe(expected);
  });
});

describe("findNextSlugNumber", () => {
  describe("basic numbering", () => {
    it("returns 2 when no existing slugs", () => {
      expect(findNextSlugNumber("my-room", [])).toBe(2);
    });

    it("returns 2 when only base slug exists (no numbered variants)", () => {
      expect(findNextSlugNumber("my-room", ["my-room"])).toBe(2);
    });

    it("returns 3 when slug-2 exists", () => {
      expect(findNextSlugNumber("my-room", ["my-room", "my-room-2"])).toBe(3);
    });

    it("returns next number after highest existing", () => {
      expect(
        findNextSlugNumber("my-room", [
          "my-room",
          "my-room-2",
          "my-room-3",
          "my-room-5",
        ]),
      ).toBe(6);
    });

    it("handles gaps in numbering", () => {
      expect(
        findNextSlugNumber("my-room", ["my-room", "my-room-2", "my-room-10"]),
      ).toBe(11);
    });
  });

  describe("case insensitivity", () => {
    it("matches slugs case-insensitively", () => {
      expect(
        findNextSlugNumber("my-room", ["MY-ROOM", "My-Room-2", "my-room-3"]),
      ).toBe(4);
    });
  });

  describe("handles null values", () => {
    it("ignores null slugs in the list", () => {
      expect(
        findNextSlugNumber("my-room", [null, "my-room", null, "my-room-2"]),
      ).toBe(3);
    });

    it("returns 2 when all slugs are null", () => {
      expect(findNextSlugNumber("my-room", [null, null])).toBe(2);
    });
  });

  describe("does not match partial slugs", () => {
    it("ignores slugs that only start with base but are different words", () => {
      // "my-room-extra" should not be counted as "my-room-<number>"
      expect(findNextSlugNumber("my-room", ["my-room", "my-room-extra"])).toBe(
        2,
      );
    });

    it("ignores slugs with text after the number", () => {
      expect(
        findNextSlugNumber("my-room", ["my-room", "my-room-2-extra"]),
      ).toBe(2);
    });
  });

  describe("regex special characters in slug", () => {
    it("handles dots in slug name safely", () => {
      // Without escaping, "v1.0" would match "v1X0-2" due to . being a wildcard
      expect(findNextSlugNumber("v1.0", ["v1.0", "v1.0-2"])).toBe(3);
      // This should NOT match because X is not a dot
      expect(findNextSlugNumber("v1.0", ["v1X0-2"])).toBe(2);
    });

    it("handles asterisks in slug name safely", () => {
      expect(
        findNextSlugNumber("test*star", ["test*star", "test*star-2"]),
      ).toBe(3);
    });

    it("handles plus signs in slug name safely", () => {
      expect(findNextSlugNumber("c++", ["c++", "c++-2"])).toBe(3);
    });

    it("handles parentheses in slug name safely", () => {
      expect(
        findNextSlugNumber("func()", ["func()", "func()-2", "func()-5"]),
      ).toBe(6);
    });

    it("handles brackets in slug name safely", () => {
      expect(findNextSlugNumber("[draft]", ["[draft]", "[draft]-2"])).toBe(3);
    });

    it("handles pipe in slug name safely", () => {
      expect(findNextSlugNumber("a|b", ["a|b", "a|b-3"])).toBe(4);
    });

    it("handles complex regex characters combination", () => {
      // Use concatenation to avoid biome warning about template-like string
      const complexSlug = "test.*+?^$" + "{}()|[]";
      expect(
        findNextSlugNumber(complexSlug, [complexSlug, `${complexSlug}-2`]),
      ).toBe(3);
    });
  });
});
