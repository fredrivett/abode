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

  // WebKit collapses a CSS multi-column grid whose children establish a
  // preserve-3d context: cards pile into the first column and the rest render
  // blank. The Safari-only @supports override flattens the face so the wall
  // paints correctly there — Chrome/Firefox keep the depth hover. Guard it so
  // the fix can't be dropped without failing here.
  it("flattens the 3D context on WebKit only, to keep the multi-column wall painting", () => {
    if (!flatCard) return;
    const cls = hoverClass(flatCard);
    expect(cls).toContain(
      "[@supports(-webkit-hyphens:none)]:[transform-style:flat]",
    );
  });

  it("leaves book cards flat (BookCover3D owns their 3D)", () => {
    expect(bookCard).toBeDefined();
    if (!bookCard) return;
    expect(hoverClass(bookCard)).not.toContain("preserve-3d");
  });
});
