import { describe, expect, test } from "vitest";
import { DEFAULT_BASE_PORT, getBasePort } from "./dev-port";

describe("getBasePort", () => {
  test("defaults to 3300", () => {
    expect(getBasePort({})).toBe(DEFAULT_BASE_PORT);
  });

  test("uses ABODE_PORT", () => {
    expect(getBasePort({ ABODE_PORT: "20010" })).toBe(20010);
  });

  test("falls back to CONDUCTOR_PORT", () => {
    expect(getBasePort({ CONDUCTOR_PORT: "55120" })).toBe(55120);
  });

  test("prefers ABODE_PORT over CONDUCTOR_PORT", () => {
    expect(getBasePort({ ABODE_PORT: "20015", CONDUCTOR_PORT: "55120" })).toBe(
      20015,
    );
  });

  test("treats an empty value as unset", () => {
    expect(getBasePort({ ABODE_PORT: "", CONDUCTOR_PORT: "55120" })).toBe(
      55120,
    );
  });

  test.each(["abc", "20010x", "0", "70000", "-1", "3.5"])(
    "rejects %s",
    (value) => {
      expect(() => getBasePort({ ABODE_PORT: value })).toThrow(
        /ABODE_PORT must be a port number/,
      );
    },
  );
});
