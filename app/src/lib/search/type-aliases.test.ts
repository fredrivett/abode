import { describe, expect, it } from "vitest";
import { ITEM_KIND_LABELS } from "@/lib/item-kind-reassignment";
import { TYPE_TERMS } from "./type-aliases";

describe("TYPE_TERMS", () => {
  it("maps every kind's own name, singular and plural, to that kind", () => {
    for (const kind of Object.keys(ITEM_KIND_LABELS)) {
      expect(TYPE_TERMS.get(kind)).toContain(kind);
      expect(TYPE_TERMS.get(`${kind}s`)).toContain(kind);
    }
  });

  it("maps every kind's display label to that kind", () => {
    // Twitter items show as "Post" — searching the label should find them
    for (const [kind, label] of Object.entries(ITEM_KIND_LABELS)) {
      expect(TYPE_TERMS.get(label.toLowerCase())).toContain(kind);
    }
  });

  it("maps common words people use for a kind", () => {
    expect(TYPE_TERMS.get("tweets")).toEqual(["twitter"]);
    expect(TYPE_TERMS.get("photos")).toEqual(["image"]);
    expect(TYPE_TERMS.get("youtube")).toEqual(["video"]);
    expect(TYPE_TERMS.get("pdfs")).toEqual(["document"]);
  });

  it("maps an ambiguous word to every kind it could mean", () => {
    expect(TYPE_TERMS.get("posts")).toEqual(["twitter", "instagram"]);
  });

  it("doesn't pluralise short abbreviations", () => {
    expect(TYPE_TERMS.has("ig")).toBe(true);
    expect(TYPE_TERMS.has("igs")).toBe(false);
  });

  it("keeps status words out of the type vocabulary", () => {
    // "read"/"reading" belong to the status facet
    for (const status of ["unread", "reading", "read", "dnf"]) {
      expect(TYPE_TERMS.has(status)).toBe(false);
    }
  });
});
