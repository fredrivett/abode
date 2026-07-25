import type { ItemKind } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canReassignKind,
  FORCIBLE_KINDS,
  ITEM_KIND_LABELS,
  isForcibleKind,
  REASSIGNABLE_TARGETS,
  reassignableTargets,
} from "./item-kind-reassignment";

const ALL_KINDS: ItemKind[] = [
  "image",
  "article",
  "twitter",
  "video",
  "product",
  "note",
  "webpage",
  "book",
];

const WEB_FAMILY: ItemKind[] = ["webpage", "article", "product", "book"];
const LOCKED: ItemKind[] = ["image", "twitter", "video", "note"];

describe("isForcibleKind", () => {
  it("accepts web-family kinds", () => {
    for (const kind of WEB_FAMILY) expect(isForcibleKind(kind)).toBe(true);
  });

  it("rejects locked kinds and null", () => {
    for (const kind of LOCKED) expect(isForcibleKind(kind)).toBe(false);
    expect(isForcibleKind(null)).toBe(false);
  });
});

describe("reassignableTargets", () => {
  it("returns the other three web-family kinds for a web-family kind", () => {
    expect([...reassignableTargets("webpage")].sort()).toEqual(
      ["article", "book", "product"].sort(),
    );
  });

  it("never includes the current kind", () => {
    for (const kind of WEB_FAMILY) {
      expect(reassignableTargets(kind)).not.toContain(kind);
    }
  });

  it("returns nothing for locked kinds and null", () => {
    for (const kind of LOCKED) expect(reassignableTargets(kind)).toEqual([]);
    expect(reassignableTargets(null)).toEqual([]);
  });

  it("only ever targets forcible kinds", () => {
    for (const kind of ALL_KINDS) {
      for (const target of reassignableTargets(kind)) {
        expect(FORCIBLE_KINDS).toContain(target);
      }
    }
  });
});

describe("canReassignKind", () => {
  it("permits switches within the web family", () => {
    expect(canReassignKind("webpage", "article")).toBe(true);
    expect(canReassignKind("article", "webpage")).toBe(true);
    expect(canReassignKind("product", "book")).toBe(true);
  });

  it("rejects switching to the same kind", () => {
    for (const kind of ALL_KINDS)
      expect(canReassignKind(kind, kind)).toBe(false);
  });

  it("rejects reassigning a locked kind", () => {
    expect(canReassignKind("twitter", "article")).toBe(false);
    expect(canReassignKind("video", "webpage")).toBe(false);
    expect(canReassignKind(null, "article")).toBe(false);
  });

  it("rejects targeting a locked kind", () => {
    expect(canReassignKind("article", "twitter")).toBe(false);
    expect(canReassignKind("webpage", "image")).toBe(false);
  });
});

describe("maps cover every kind", () => {
  it("REASSIGNABLE_TARGETS has an entry per kind", () => {
    for (const kind of ALL_KINDS) {
      expect(REASSIGNABLE_TARGETS[kind]).toBeDefined();
    }
  });

  it("ITEM_KIND_LABELS has a label per kind", () => {
    for (const kind of ALL_KINDS) {
      expect(ITEM_KIND_LABELS[kind]).toBeTruthy();
    }
  });
});
