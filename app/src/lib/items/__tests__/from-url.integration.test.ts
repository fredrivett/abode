/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { tasks } from "@trigger.dev/sdk";
import { USER_ACTION_PRIORITY } from "@/lib/items/enqueue-user-processing";
import { createItemFromUrl } from "@/lib/items/from-url";
import { captureServerException } from "@/lib/posthog-server";

// Trigger.dev is an external service — mock it so we can force enqueue
// success/failure. The item persistence goes through the real test database.
vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: vi.fn() },
}));

// Stub PostHog so no network calls fire and we can assert the exception report.
vi.mock("@/lib/posthog-server", () => ({
  captureServerException: vi.fn(),
  getPostHogClient: () => null,
}));

// Milestones are a separate concern; keep this test focused on enqueue outcome.
vi.mock("@/lib/milestones", () => ({
  markMilestoneComplete: vi.fn(),
}));

describe("createItemFromUrl integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.clearAllMocks();
  });

  const createUser = async () => {
    const { write } = await import("@/lib/db");
    return write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `url-${crypto.randomUUID()}@example.com`,
      },
    });
  };

  const readItem = async (itemId: string) => {
    const { read } = await import("@/lib/db");
    return read.item.findUniqueOrThrow({
      where: { id: itemId },
      select: { processingStatus: true, processingError: true },
    });
  };

  test("persists the item and enqueues classify-url on success", async () => {
    const user = await createUser();
    vi.mocked(tasks.trigger).mockResolvedValueOnce(undefined as never);

    const item = await createItemFromUrl({
      userId: user.id,
      url: "https://x.com/soleio/status/2084959467012063266",
      source: "web",
    });

    expect(await readItem(item.id)).toMatchObject({
      processingStatus: "processing",
      processingError: null,
    });
    expect(vi.mocked(tasks.trigger)).toHaveBeenCalledWith(
      "classify-url",
      expect.objectContaining({ itemId: item.id, userId: user.id }),
      expect.objectContaining({
        concurrencyKey: user.id,
        priority: USER_ACTION_PRIORITY,
      }),
    );
    expect(vi.mocked(captureServerException)).not.toHaveBeenCalled();
  });

  test("marks the item failed with enqueue_failed and reports when enqueue throws", async () => {
    const user = await createUser();
    const enqueueError = new Error("Trigger.dev unreachable");
    vi.mocked(tasks.trigger).mockRejectedValueOnce(enqueueError);

    // Must not throw — the item is already persisted, so a queueing hiccup must
    // not fail the save.
    const item = await createItemFromUrl({
      userId: user.id,
      url: "https://x.com/soleio/status/2084959467012063266",
      source: "web",
    });

    // Failed with a concrete reason, not a null the admin UI has to paper over.
    expect(await readItem(item.id)).toMatchObject({
      processingStatus: "failed",
      processingError: "enqueue_failed",
    });
    // The enqueue call throwing leaves no Trigger run to inspect, so it must be
    // reported explicitly.
    expect(vi.mocked(captureServerException)).toHaveBeenCalledWith(
      enqueueError,
      user.id,
      expect.objectContaining({
        stage: "trigger:classify-url",
        itemId: item.id,
      }),
    );
  });
});
