import { describe, expect, it } from "vitest";
import {
  MAX_INVITE_ALLOCATION,
  parseInviteAllocation,
} from "./invite-allocation";

describe("parseInviteAllocation", () => {
  it.each([
    [0, 0],
    [3, 3],
    [MAX_INVITE_ALLOCATION, MAX_INVITE_ALLOCATION],
    ["12", 12],
    [" 7 ", 7],
  ])("accepts %j", (input, expected) => {
    expect(parseInviteAllocation(input)).toBe(expected);
  });

  it.each([
    -1,
    MAX_INVITE_ALLOCATION + 1,
    2.5,
    Number.NaN,
    "",
    "  ",
    "abc",
    "3.5",
    null,
    undefined,
    true,
  ])("rejects %j", (input) => {
    expect(parseInviteAllocation(input)).toBeNull();
  });
});
