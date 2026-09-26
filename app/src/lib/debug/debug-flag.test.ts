import { afterEach, describe, expect, it } from "vitest";
import {
  applyDebugParam,
  DEBUG_STORAGE_KEY,
  isDebugFlagOn,
  parseDebugParam,
  setDebugFlag,
} from "./debug-flag";

describe("parseDebugParam", () => {
  it.each([
    ["?debug=1", true],
    ["?debug=true", true],
    ["?debug=0", false],
    ["?debug=false", false],
    ["?debug=yes", null],
    ["?item=abc", null],
    ["", null],
  ])("%s → %s", (search, expected) => {
    expect(parseDebugParam(search)).toBe(expected);
  });
});

describe("debug flag", () => {
  afterEach(() => {
    window.localStorage.removeItem(DEBUG_STORAGE_KEY);
    window.history.replaceState(null, "", "/");
  });

  it("persists on/off in localStorage", () => {
    expect(isDebugFlagOn()).toBe(false);
    setDebugFlag(true);
    expect(isDebugFlagOn()).toBe(true);
    expect(window.localStorage.getItem(DEBUG_STORAGE_KEY)).toBe("1");
    setDebugFlag(false);
    expect(isDebugFlagOn()).toBe(false);
  });

  it("applies ?debug=1 and ?debug=0 from the URL", () => {
    window.history.replaceState(null, "", "/dashboard?debug=1");
    applyDebugParam();
    expect(isDebugFlagOn()).toBe(true);
    window.history.replaceState(null, "", "/dashboard?debug=0");
    applyDebugParam();
    expect(isDebugFlagOn()).toBe(false);
  });

  it("leaves the flag alone when the URL has no debug param", () => {
    setDebugFlag(true);
    window.history.replaceState(null, "", "/dashboard?item=abc");
    applyDebugParam();
    expect(isDebugFlagOn()).toBe(true);
  });
});
