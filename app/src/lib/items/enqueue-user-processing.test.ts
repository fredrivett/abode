import { beforeEach, describe, expect, it, vi } from "vitest";

const trigger = vi.hoisted(() => vi.fn());
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger } }));

import {
  enqueueUserProcessing,
  USER_ACTION_PRIORITY,
} from "@/lib/items/enqueue-user-processing";

describe("enqueueUserProcessing", () => {
  beforeEach(() => {
    trigger.mockReset().mockResolvedValue({ id: "run_1" });
  });

  const optionsOf = () => trigger.mock.calls[0]?.[2] as Record<string, unknown>;

  it("bakes in the per-user concurrencyKey + user-action priority", () => {
    enqueueUserProcessing("analyze-image", { itemId: "i1" }, "u1");
    expect(optionsOf()).toMatchObject({
      concurrencyKey: "u1",
      priority: USER_ACTION_PRIORITY,
    });
  });

  it("tags the run with item_<id> and user_<id> when the payload has an itemId", () => {
    enqueueUserProcessing("analyze-image", { itemId: "i1" }, "u1");
    expect(optionsOf().tags).toEqual(["item_i1", "user_u1"]);
  });

  it("still tags the user when the payload carries no itemId", () => {
    enqueueUserProcessing("some-task", { foo: "bar" }, "u1");
    expect(optionsOf().tags).toEqual(["user_u1"]);
  });
});
