import { describe, expect, it } from "vitest";
import { getInitials } from "./get-initials";

describe("getInitials", () => {
  it("uses first letters from first and last name", () => {
    expect(getInitials({ firstName: "Fred", lastName: "Rivett" })).toBe("FR");
  });

  it("handles whitespace and casing", () => {
    expect(getInitials({ firstName: "  fred ", lastName: " rivett " })).toBe(
      "FR",
    );
  });

  it("falls back to a single name when only one exists", () => {
    expect(getInitials({ firstName: "Fred" })).toBe("F");
    expect(getInitials({ lastName: "Rivett" })).toBe("R");
  });

  it("falls back to fallback string when names are empty", () => {
    expect(
      getInitials({ firstName: " ", lastName: "", fallback: "Account" }),
    ).toBe("A");
  });

  it("returns U when nothing is available", () => {
    expect(
      getInitials({ firstName: null, lastName: null, fallback: null }),
    ).toBe("U");
  });
});
