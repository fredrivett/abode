import { describe, expect, it } from "vitest";
import { formatInvitedCount } from "./format-invited-count";

describe("formatInvitedCount", () => {
  it("uses the singular noun for one", () => {
    expect(formatInvitedCount(1)).toBe("1 person");
  });

  it("uses the plural noun for more than one", () => {
    expect(formatInvitedCount(2)).toBe("2 people");
    expect(formatInvitedCount(42)).toBe("42 people");
  });

  it("uses the plural noun for zero", () => {
    expect(formatInvitedCount(0)).toBe("0 people");
  });
});
