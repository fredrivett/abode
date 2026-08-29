import { describe, expect, it, vi } from "vitest";

// Importing init.ts registers the global hook as a side effect; stub the SDK so
// the module loads without a Trigger runtime, and capture the registered hook.
const onStartAttempt = vi.hoisted(() => vi.fn());
const tagsAdd = vi.hoisted(() => vi.fn());
vi.mock("@trigger.dev/sdk", () => ({
  tasks: { onStartAttempt },
  tags: { add: tagsAdd },
}));
const captureServerException = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/posthog-server", () => ({ captureServerException }));

import { itemRunTagsForPayload } from "./init";

type Hook = (params: { payload: unknown }) => Promise<void>;
const registeredHook = onStartAttempt.mock.calls[0][0] as Hook;

describe("itemRunTagsForPayload", () => {
  it("tags item + user for an item-processing payload", () => {
    expect(
      itemRunTagsForPayload({ itemId: "i1", userId: "u1", fileKey: "x" }),
    ).toEqual(["item_i1", "user_u1"]);
  });

  it("returns [] for payloads that don't identify an item", () => {
    expect(itemRunTagsForPayload({ foo: "bar" })).toEqual([]);
    expect(itemRunTagsForPayload(null)).toEqual([]);
    expect(itemRunTagsForPayload(undefined)).toEqual([]);
    // partial payloads (missing userId) are not enough to tag
    expect(itemRunTagsForPayload({ itemId: "i1" })).toEqual([]);
    expect(itemRunTagsForPayload({ itemId: 1, userId: "u1" })).toEqual([]);
  });
});

describe("onStartAttempt tagging hook", () => {
  it("adds the item tags for an item payload", async () => {
    tagsAdd.mockReset().mockResolvedValue(undefined);
    await registeredHook({ payload: { itemId: "i1", userId: "u1" } });
    expect(tagsAdd).toHaveBeenCalledWith(["item_i1", "user_u1"]);
  });

  it("skips the API for a non-item payload", async () => {
    tagsAdd.mockReset();
    await registeredHook({ payload: { foo: "bar" } });
    expect(tagsAdd).not.toHaveBeenCalled();
  });

  it("swallows a tags.add failure so the run still starts (best-effort)", async () => {
    tagsAdd.mockReset().mockRejectedValue(new Error("tag API down"));
    captureServerException.mockReset();
    await expect(
      registeredHook({ payload: { itemId: "i1", userId: "u1" } }),
    ).resolves.toBeUndefined();
    expect(captureServerException).toHaveBeenCalled();
  });
});
