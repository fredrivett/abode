import { describe, expect, it } from "vitest";
import { chipSearchAnalytics, chipSearchState } from "./chip-search";

describe("chipSearchState", () => {
  it("replaces the query with a single filter for the chip value", () => {
    const state = chipSearchState({ type: "object", value: "Car" });
    expect(state.query).toBe("");
    expect(state.filters).toHaveLength(1);
    expect(state.filters[0]).toMatchObject({
      type: "object",
      value: "Car",
      negated: false,
    });
    expect(state.filters[0].id).toBeTruthy();
  });

  it("works across chip types (color, tag)", () => {
    expect(
      chipSearchState({ type: "color", value: "#FF5733" }).filters[0],
    ).toMatchObject({ type: "color", value: "#FF5733" });
    expect(
      chipSearchState({ type: "tag", value: "Custom", isUserTag: true })
        .filters[0],
    ).toMatchObject({ type: "tag", value: "Custom" });
  });

  it("gives each click a unique filter id", () => {
    const a = chipSearchState({ type: "object", value: "Car" });
    const b = chipSearchState({ type: "object", value: "Car" });
    expect(a.filters[0].id).not.toBe(b.filters[0].id);
  });
});

describe("chipSearchAnalytics", () => {
  it("includes the raw value for colors and Vision objects/tags", () => {
    expect(
      chipSearchAnalytics({ itemId: "i1", type: "color", value: "#FF5733" }),
    ).toEqual({ item_id: "i1", facet: "color", value: "#FF5733" });
    expect(
      chipSearchAnalytics({ itemId: "i1", type: "object", value: "Car" }),
    ).toEqual({ item_id: "i1", facet: "object", value: "Car" });
    expect(
      chipSearchAnalytics({ itemId: "i1", type: "tag", value: "Sedan" }),
    ).toEqual({ item_id: "i1", facet: "tag", value: "Sedan" });
  });

  it("omits the raw value for user tags (may be personal)", () => {
    const payload = chipSearchAnalytics({
      itemId: "i1",
      type: "tag",
      value: "my private note",
      isUserTag: true,
    });
    expect(payload).toEqual({ item_id: "i1", facet: "userTag" });
    expect(payload).not.toHaveProperty("value");
  });
});
