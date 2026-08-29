import { beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.hoisted(() => vi.fn());
vi.mock("@trigger.dev/sdk", () => ({ runs: { list } }));

const env = vi.hoisted(() => ({
  TRIGGER_SECRET_KEY: "tr_dev_x" as string | undefined,
}));
vi.mock("@/env.server", () => ({ env }));

vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
const captureServerException = vi.hoisted(() => vi.fn());
vi.mock("@/lib/posthog-server", () => ({ captureServerException }));

import { isTriggerConfigured, listItemRuns } from "@/lib/trigger/item-runs";

const run = (over: Record<string, unknown> = {}) => ({
  id: "run_1",
  status: "COMPLETED",
  taskIdentifier: "analyze-image",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  startedAt: new Date("2026-01-01T00:00:01Z"),
  finishedAt: new Date("2026-01-01T00:00:03Z"),
  durationMs: 2000,
  costInCents: 1,
  ...over,
});

describe("item-runs", () => {
  beforeEach(() => {
    env.TRIGGER_SECRET_KEY = "tr_dev_x";
    list.mockReset();
    captureServerException.mockReset();
  });

  it("reports not_configured (and skips the API) when the secret is absent", async () => {
    env.TRIGGER_SECRET_KEY = undefined;
    expect(isTriggerConfigured()).toBe(false);
    expect(await listItemRuns("item_1")).toEqual({ state: "not_configured" });
    expect(list).not.toHaveBeenCalled();
  });

  it("filters by the item tag and maps runs to the trimmed shape", async () => {
    list.mockResolvedValue([run()]);
    const result = await listItemRuns("item_1");

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ tag: ["item_item_1"] }),
    );
    expect(result).toEqual({
      state: "ok",
      runs: [
        {
          id: "run_1",
          status: "COMPLETED",
          taskIdentifier: "analyze-image",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          startedAt: new Date("2026-01-01T00:00:01Z"),
          finishedAt: new Date("2026-01-01T00:00:03Z"),
          durationMs: 2000,
          costInCents: 1,
        },
      ],
    });
  });

  it("coerces missing started/finished timestamps to null", async () => {
    list.mockResolvedValue([
      run({ startedAt: undefined, finishedAt: undefined }),
    ]);
    const result = await listItemRuns("item_1");
    if (result.state !== "ok") throw new Error("expected ok");
    expect(result.runs[0].startedAt).toBeNull();
    expect(result.runs[0].finishedAt).toBeNull();
  });

  it("degrades to error (reported, non-fatal) when the API throws", async () => {
    list.mockRejectedValue(new Error("boom"));
    const result = await listItemRuns("item_1");
    expect(result).toEqual({ state: "error" });
    expect(captureServerException).toHaveBeenCalledWith(
      expect.any(Error),
      undefined,
      expect.objectContaining({ stage: "trigger:runs.list", itemId: "item_1" }),
    );
  });
});
