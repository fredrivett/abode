import { describe, expect, it } from "vitest";
import { shortBranchName } from "./branch-title";

describe("shortBranchName", () => {
  it("drops a username/ prefix", () => {
    expect(shortBranchName("fredrivett/local-branch-page-title")).toBe(
      "local-branch-page-title",
    );
  });

  it("takes the last segment across nested slashes", () => {
    expect(shortBranchName("fredrivett/feature/foo/bar")).toBe("bar");
  });

  it("returns a plain branch name unchanged", () => {
    expect(shortBranchName("main")).toBe("main");
  });

  it("returns undefined for undefined input", () => {
    expect(shortBranchName(undefined)).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(shortBranchName("")).toBeUndefined();
  });

  it("returns undefined for a trailing slash", () => {
    expect(shortBranchName("fredrivett/")).toBeUndefined();
  });

  it("trims surrounding whitespace", () => {
    expect(shortBranchName("fredrivett/foo ")).toBe("foo");
  });
});
