/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { tasks } from "@trigger.dev/sdk";
import { enqueueImageAnalysis } from "@/lib/items/enqueue-image-analysis";
import { USER_ACTION_PRIORITY } from "@/lib/items/enqueue-user-processing";

// Trigger.dev is an external service — mock it so we can force enqueue
// success/failure. The item persistence goes through the real test database.
vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: vi.fn() },
}));

describe("enqueueImageAnalysis integration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.clearAllMocks();
  });

  const createImageItem = async () => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `img-${crypto.randomUUID()}@example.com`,
      },
    });
    const item = await write.item.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        kind: "image",
        fileKey: `${user.id}/photo.jpg`,
        processingStatus: "processing",
      },
      select: { id: true, userId: true, fileKey: true },
    });
    return item;
  };

  const readStatus = async (itemId: string) => {
    const { read } = await import("@/lib/db");
    const item = await read.item.findUniqueOrThrow({
      where: { id: itemId },
      select: { processingStatus: true, processingError: true },
    });
    return item;
  };

  test("marks the item failed (without throwing) when enqueue fails", async () => {
    const item = await createImageItem();
    vi.mocked(tasks.trigger).mockRejectedValueOnce(
      new Error("Trigger.dev unreachable"),
    );

    // Must not throw — capture already succeeded; enrichment is best-effort
    await expect(
      enqueueImageAnalysis({
        itemId: item.id,
        userId: item.userId,
        fileKey: item.fileKey ?? "",
      }),
    ).resolves.toBeUndefined();

    // Failed with a concrete reason so the failure is attributable, not a null
    // the admin UI has to paper over.
    expect(await readStatus(item.id)).toMatchObject({
      processingStatus: "failed",
      processingError: "enqueue_failed",
    });
  });

  test("leaves the item untouched when enqueue succeeds", async () => {
    const item = await createImageItem();
    vi.mocked(tasks.trigger).mockResolvedValueOnce(undefined as never);

    await enqueueImageAnalysis({
      itemId: item.id,
      userId: item.userId,
      fileKey: item.fileKey ?? "",
    });

    expect(await readStatus(item.id)).toMatchObject({
      processingStatus: "processing",
    });
  });

  test("enqueues at the positive user-action priority (jumps background work)", async () => {
    const item = await createImageItem();
    vi.mocked(tasks.trigger).mockResolvedValueOnce(undefined as never);

    await enqueueImageAnalysis({
      itemId: item.id,
      userId: item.userId,
      fileKey: item.fileKey ?? "",
    });

    // The wrapper owns both options: a per-user concurrencyKey and a positive
    // priority (a createdAt offset that dequeues user runs ahead of priority-0
    // background work). A negative priority would strand the run in `queued` (it
    // schedules into the future) — guard against that regression.
    const options = vi.mocked(tasks.trigger).mock.calls[0]?.[2];
    expect(options).toMatchObject({
      concurrencyKey: item.userId,
      priority: USER_ACTION_PRIORITY,
    });
    expect(USER_ACTION_PRIORITY).toBeGreaterThan(0);
  });
});
