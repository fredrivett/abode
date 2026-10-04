import { afterEach, describe, expect, it } from "vitest";
import { isUiLabel, parseUiLabels, setUiLabels } from "./ui-labels";

describe("parseUiLabels", () => {
  it("parses the build-inlined JSON list", () => {
    expect(parseUiLabels('["Save","Delete"]')).toEqual(["Save", "Delete"]);
  });

  it.each([undefined, "", "not json", '{"Save":true}', '["Save", 1]'])(
    "treats %j as no labels",
    (raw) => {
      expect(parseUiLabels(raw)).toEqual([]);
    },
  );
});

describe("isUiLabel", () => {
  afterEach(() => setUiLabels([]));

  it("matches UI copy, ignoring spacing", () => {
    setUiLabels(["Save", "Create token"]);
    expect(isUiLabel("Save")).toBe(true);
    expect(isUiLabel("  Create\n token ")).toBe(true);
  });

  it("rejects anything else", () => {
    setUiLabels(["Save"]);
    expect(isUiLabel("My secret shopping list")).toBe(false);
  });

  it("matches nothing without a list (tests, or a failed extraction)", () => {
    expect(isUiLabel("Save")).toBe(false);
  });
});
