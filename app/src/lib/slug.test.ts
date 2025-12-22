import { describe, expect, it } from "vitest";
import { nameToSlug } from "./slug";

describe("nameToSlug", () => {
  it("converts basic text to lowercase slug", () => {
    expect(nameToSlug("My Room")).toBe("my-room");
  });

  it("handles multiple spaces", () => {
    expect(nameToSlug("My   Room   Name")).toBe("my-room-name");
  });

  it("removes special characters", () => {
    expect(nameToSlug("My Room! @#$% Test")).toBe("my-room-test");
  });

  it("handles leading and trailing spaces", () => {
    expect(nameToSlug("  My Room  ")).toBe("my-room");
  });

  it("handles leading and trailing special characters", () => {
    expect(nameToSlug("---My Room---")).toBe("my-room");
  });

  it("preserves numbers", () => {
    expect(nameToSlug("Room 123")).toBe("room-123");
  });

  it("handles unicode characters", () => {
    expect(nameToSlug("Café & Résumé")).toBe("caf-r-sum");
  });

  it("handles emojis", () => {
    expect(nameToSlug("My 🏠 Room")).toBe("my-room");
  });

  it("returns untitled for empty string", () => {
    expect(nameToSlug("")).toBe("untitled");
  });

  it("returns untitled for whitespace only", () => {
    expect(nameToSlug("   ")).toBe("untitled");
  });

  it("returns untitled for special characters only", () => {
    expect(nameToSlug("!@#$%^&*()")).toBe("untitled");
  });

  it("handles mixed case", () => {
    expect(nameToSlug("MyAwesomeRoom")).toBe("myawesomeroom");
  });

  it("handles already slugified input", () => {
    expect(nameToSlug("my-room")).toBe("my-room");
  });

  it("handles single word", () => {
    expect(nameToSlug("Room")).toBe("room");
  });

  it("handles apostrophes", () => {
    expect(nameToSlug("Fred's Room")).toBe("fred-s-room");
  });

  it("handles ampersands", () => {
    expect(nameToSlug("Art & Design")).toBe("art-design");
  });
});
