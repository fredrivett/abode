import { describe, expect, it } from "vitest";
import { canUseScanner } from "./scanner-entry";

describe("canUseScanner", () => {
  it.each([
    { isAdmin: true, isDevelopment: false, expected: true },
    { isAdmin: false, isDevelopment: true, expected: true },
    { isAdmin: undefined, isDevelopment: true, expected: true },
    { isAdmin: false, isDevelopment: false, expected: false },
    { isAdmin: undefined, isDevelopment: false, expected: false },
  ])(
    "isAdmin=$isAdmin dev=$isDevelopment → $expected",
    ({ isAdmin, isDevelopment, expected }) => {
      expect(canUseScanner({ isAdmin, isDevelopment })).toBe(expected);
    },
  );
});
