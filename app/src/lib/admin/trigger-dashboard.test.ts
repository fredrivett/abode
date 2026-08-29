import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ TRIGGER_RUNS_DASHBOARD_URL: "" as string }));
vi.mock("@/env.server", () => ({ env }));

import { triggerRunsUrl, triggerRunUrl } from "@/lib/admin/trigger-dashboard";

describe("triggerRunsUrl", () => {
  afterEach(() => {
    env.TRIGGER_RUNS_DASHBOARD_URL = "";
  });

  it("returns null when the dashboard base URL is unset (graceful degrade)", () => {
    env.TRIGGER_RUNS_DASHBOARD_URL = "";
    expect(triggerRunsUrl(["item_i1"])).toBeNull();
  });

  it("appends a tag filter to the configured base", () => {
    env.TRIGGER_RUNS_DASHBOARD_URL = "https://dash.example/runs";
    expect(triggerRunsUrl(["item_i1"], { rootOnly: false })).toBe(
      "https://dash.example/runs?tags=item_i1&rootOnly=false",
    );
  });

  it("preserves an existing query string with & and includes period", () => {
    env.TRIGGER_RUNS_DASHBOARD_URL = "https://dash.example/runs?env=prod";
    expect(
      triggerRunsUrl(["admin-reprocess"], { period: "1d", rootOnly: false }),
    ).toBe(
      "https://dash.example/runs?env=prod&tags=admin-reprocess&period=1d&rootOnly=false",
    );
  });

  it("OR-combines multiple tags", () => {
    env.TRIGGER_RUNS_DASHBOARD_URL = "https://dash.example/runs";
    expect(triggerRunsUrl(["a", "b"])).toBe(
      "https://dash.example/runs?tags=a&tags=b",
    );
  });
});

describe("triggerRunUrl", () => {
  afterEach(() => {
    env.TRIGGER_RUNS_DASHBOARD_URL = "";
  });

  it("returns null when the dashboard base URL is unset", () => {
    env.TRIGGER_RUNS_DASHBOARD_URL = "";
    expect(triggerRunUrl("run_1")).toBeNull();
  });

  it("appends the run id as a path segment", () => {
    env.TRIGGER_RUNS_DASHBOARD_URL = "https://dash.example/env/prod/runs";
    expect(triggerRunUrl("run_1")).toBe(
      "https://dash.example/env/prod/runs/run_1",
    );
  });

  it("preserves a query string and a trailing slash on the base", () => {
    env.TRIGGER_RUNS_DASHBOARD_URL = "https://dash.example/runs/?env=prod";
    expect(triggerRunUrl("run_1")).toBe(
      "https://dash.example/runs/run_1?env=prod",
    );
  });
});
