import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLatestBuild, isNewerBuild, parseLatestRun } from "./updates";

describe("isNewerBuild", () => {
  it("is true when the latest run number is higher", () => {
    expect(isNewerBuild(227, 234)).toBe(true);
  });
  it("is false when equal (already on latest)", () => {
    expect(isNewerBuild(234, 234)).toBe(false);
  });
  it("is false when the local build is somehow ahead", () => {
    expect(isNewerBuild(240, 234)).toBe(false);
  });
});

describe("parseLatestRun", () => {
  const run = {
    run_number: 234,
    head_sha: "def5678abcdef0123456789",
    html_url: "https://github.com/fredrivett/abode/actions/runs/1",
  };

  it("pulls the number, short sha and run url from the newest run", () => {
    expect(parseLatestRun({ workflow_runs: [run] })).toEqual({
      number: 234,
      sha: "def5678",
      url: run.html_url,
    });
  });

  it("throws when no successful build exists", () => {
    expect(() => parseLatestRun({ workflow_runs: [] })).toThrow();
  });

  it("throws on a malformed response", () => {
    expect(() => parseLatestRun({})).toThrow();
    expect(() => parseLatestRun(null)).toThrow();
    expect(() => parseLatestRun({ workflow_runs: [{ run_number: "x" }] })).toThrow();
  });
});

describe("fetchLatestBuild", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the parsed latest build", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          workflow_runs: [
            { run_number: 234, head_sha: "def5678aa", html_url: "https://x/1" },
          ],
        }),
      }),
    );
    await expect(fetchLatestBuild()).resolves.toEqual({
      number: 234,
      sha: "def5678",
      url: "https://x/1",
    });
  });

  it("throws on a non-ok response (e.g. rate limited)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(fetchLatestBuild()).rejects.toThrow("403");
  });
});
