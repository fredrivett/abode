import { beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.hoisted(() => vi.fn());
const retrieve = vi.hoisted(() => vi.fn());
vi.mock("@trigger.dev/sdk", () => ({ runs: { list, retrieve } }));

const env = vi.hoisted(() => ({
  TRIGGER_SECRET_KEY: "tr_dev_x" as string | undefined,
}));
vi.mock("@/env.server", () => ({ env }));

vi.mock("@/lib/logger.server", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
const captureServerException = vi.hoisted(() => vi.fn());
vi.mock("@/lib/posthog-server", () => ({ captureServerException }));

import {
  buildItemRunForest,
  type ItemRun,
  isTriggerConfigured,
  listItemRuns,
} from "@/lib/trigger/item-runs";

const run = (over: Record<string, unknown> = {}) => ({
  id: "run_1",
  status: "COMPLETED",
  taskIdentifier: "analyze-image",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  startedAt: new Date("2026-01-01T00:00:01Z"),
  finishedAt: new Date("2026-01-01T00:00:03Z"),
  durationMs: 2000,
  costInCents: 1,
  parentRunId: null,
  ...over,
});

describe("item-runs", () => {
  beforeEach(() => {
    env.TRIGGER_SECRET_KEY = "tr_dev_x";
    list.mockReset();
    retrieve.mockReset().mockResolvedValue({ relatedRuns: {} });
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
          parentRunId: null,
        },
      ],
    });
  });

  it("fills parentRunId from a per-run retrieve so children can nest", async () => {
    list.mockResolvedValue([run({ id: "child" })]);
    retrieve.mockResolvedValue({ relatedRuns: { parent: { id: "root" } } });
    const result = await listItemRuns("item_1");
    expect(retrieve).toHaveBeenCalledWith("child");
    if (result.state !== "ok") throw new Error("expected ok");
    expect(result.runs[0].parentRunId).toBe("root");
  });

  it("leaves parentRunId null when the retrieve lookup fails", async () => {
    list.mockResolvedValue([run({ id: "child" })]);
    retrieve.mockRejectedValue(new Error("nope"));
    const result = await listItemRuns("item_1");
    if (result.state !== "ok") throw new Error("expected ok");
    expect(result.runs[0].parentRunId).toBeNull();
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

describe("buildItemRunForest", () => {
  const node = (
    id: string,
    parentRunId: string | null,
    createdAt: string,
  ): ItemRun =>
    run({ id, parentRunId, createdAt: new Date(createdAt) }) as ItemRun;

  const shape = (runs: ItemRun[]) =>
    buildItemRunForest(runs).map((n) => [n.run.id, n.indent] as const);

  it("nests a linear pipeline under its root in pre-order", () => {
    const runs = [
      node("sync", "enrich", "2026-01-01T00:03:00Z"),
      node("enrich", "analyze", "2026-01-01T00:02:00Z"),
      node("analyze", "classify", "2026-01-01T00:01:00Z"),
      node("classify", null, "2026-01-01T00:00:00Z"),
    ];
    expect(shape(runs)).toEqual([
      ["classify", 0],
      ["analyze", 1],
      ["enrich", 2],
      ["sync", 3],
    ]);
  });

  it("nests a branch under the correct parent (not a same-level sibling)", () => {
    // classify → { analyze, enrich }; sync is a child of enrich specifically
    const runs = [
      node("classify", null, "2026-01-01T00:00:00Z"),
      node("analyze", "classify", "2026-01-01T00:01:00Z"),
      node("enrich", "classify", "2026-01-01T00:02:00Z"),
      node("sync", "enrich", "2026-01-01T00:03:00Z"),
    ];
    expect(shape(runs)).toEqual([
      ["classify", 0],
      ["analyze", 1],
      ["enrich", 1],
      ["sync", 2],
    ]);
  });

  it("keeps separate roots as top-level nodes, newest first", () => {
    const runs = [
      node("retry", null, "2026-01-01T01:00:00Z"),
      node("retry-child", "retry", "2026-01-01T01:00:10Z"),
      node("first", null, "2026-01-01T00:00:00Z"),
      node("first-child", "first", "2026-01-01T00:00:10Z"),
    ];
    expect(shape(runs)).toEqual([
      ["retry", 0],
      ["retry-child", 1],
      ["first", 0],
      ["first-child", 1],
    ]);
  });

  it("treats a run whose parent isn't in the set as a root", () => {
    const runs = [node("orphan", "missing-parent", "2026-01-01T00:00:00Z")];
    expect(shape(runs)).toEqual([["orphan", 0]]);
  });
});
