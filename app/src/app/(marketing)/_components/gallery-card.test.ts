import { describe, expect, it } from "vitest";
import { hoverClass } from "./gallery-card";
import { GALLERY_CARDS } from "./gallery-data";

const bookCard = GALLERY_CARDS.find((c) => c.kind === "book");
const flatCard = GALLERY_CARDS.find((c) => c.kind !== "book");

describe("hoverClass", () => {
  it("gives non-book cards the 3D depth hover", () => {
    expect(flatCard).toBeDefined();
    if (!flatCard) return;
    expect(hoverClass(flatCard)).toContain("[transform-style:preserve-3d]");
  });

  it("leaves book cards flat (BookCover3D owns their 3D)", () => {
    expect(bookCard).toBeDefined();
    if (!bookCard) return;
    expect(hoverClass(bookCard)).not.toContain("preserve-3d");
  });
});
