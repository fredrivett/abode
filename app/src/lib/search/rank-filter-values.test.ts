import { describe, expect, it } from "vitest";
import { rankFilterValues } from "./rank-filter-values";

describe("rankFilterValues", () => {
  it("ranks a prefix match above a substring match", () => {
    // alphabetical input would put "dark orange" first
    expect(rankFilterValues(["dark orange", "orange"], "oran")).toEqual([
      "orange",
      "dark orange",
    ]);
  });

  it("ranks an exact match above other matches", () => {
    expect(
      rankFilterValues(["orange red", "orange", "dark orange"], "orange"),
    ).toEqual(["orange", "orange red", "dark orange"]);
  });

  it("preserves incoming order within the same match tier (stable)", () => {
    // production feeds alphabetical values in, so this keeps them alphabetical
    expect(rankFilterValues(["black", "blue", "blush"], "bl")).toEqual([
      "black",
      "blue",
      "blush",
    ]);
  });

  it("filters out values that don't match", () => {
    expect(rankFilterValues(["orange", "green", "blue"], "gr")).toEqual([
      "green",
    ]);
  });

  it("is case-insensitive", () => {
    expect(rankFilterValues(["Orange", "Dark Orange"], "ORAN")).toEqual([
      "Orange",
      "Dark Orange",
    ]);
  });

  it("returns the list unchanged when the query is empty", () => {
    const values = ["dark orange", "orange"];
    expect(rankFilterValues(values, "")).toEqual(values);
    expect(rankFilterValues(values, "   ")).toEqual(values);
  });
});
