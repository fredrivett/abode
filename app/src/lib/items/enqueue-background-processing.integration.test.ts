/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";

// The Trigger.dev SDK is mocked so we can assert enqueue vs. defer without a
// real queue; everything else (DB, usage counts) is real.
const trigger = vi.hoisted(() => vi.fn());
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger } }));

import { enqueueBackgroundProcessing } from "@/lib/items/enqueue-background-processing";
import { backgroundLimitFor, getDailyCount } from "@/lib/usage-limits";

describe("enqueueBackgroundProcessing", () => {
  const originalFlag = process.env.USAGE_LIMITS_ENFORCED;

  beforeEach(async () => {
    await resetTestDatabase();
    trigger.mockReset().mockResolvedValue({ id: "run_1" });
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.USAGE_LIMITS_ENFORCED;
    else process.env.USAGE_LIMITS_ENFORCED = originalFlag;
  });

  const createItem = async (): Promise<{ userId: string; itemId: string }> => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `bg-${crypto.randomUUID()}@example.com`,
      },
    });
    const item = await write.item.create({
      data: {
        id: crypto.randomUUID(),
        user: { connect: { id: user.id } },
        kind: "book",
        processingStatus: "pending",
      },
      select: { id: true },
    });
    return { userId: user.id, itemId: item.id };
  };

  const seedCount = async (userId: string, count: number) => {
    const { write } = await import("@/lib/db");
    await write.$executeRaw`
      INSERT INTO usage_daily (user_id, day, bucket, count, updated_at)
      VALUES (${userId}::uuid, (now() AT TIME ZONE 'utc')::date, 'ingestion', ${count}, now())
    `;
  };

  const statusOf = async (itemId: string) => {
    const { read } = await import("@/lib/db");
    const item = await read.item.findUnique({
      where: { id: itemId },
      select: { processingStatus: true },
    });
    return item?.processingStatus;
  };

  const run = (userId: string, itemId: string) =>
    enqueueBackgroundProcessing({
      id: "enrich-item",
      payload: { itemId, userId, sourceText: "x" },
      userId,
      bucket: "ingestion",
    });

  test("enforced + under the reserve → enqueues, claims processing, draws down the count", async () => {
    process.env.USAGE_LIMITS_ENFORCED = "true";
    const { userId, itemId } = await createItem();

    const result = await run(userId, itemId);

    expect(result).toEqual({ status: "enqueued" });
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger.mock.calls[0][2]).toMatchObject({
      concurrencyKey: userId,
      tags: [`item_${itemId}`, `user_${userId}`],
    });
    // Background work runs at the default priority (never USER_ACTION_PRIORITY).
    expect(trigger.mock.calls[0][2].priority).toBeUndefined();
    expect(await statusOf(itemId)).toBe("processing");
    expect(await getDailyCount(userId, "ingestion")).toBe(1);
  });

  test("enforced + at the reserve boundary → defers, no trigger, count untouched", async () => {
    process.env.USAGE_LIMITS_ENFORCED = "true";
    const { userId, itemId } = await createItem();
    const limit = backgroundLimitFor("ingestion"); // 120
    await seedCount(userId, limit);

    const result = await run(userId, itemId);

    expect(result).toEqual({ status: "deferred" });
    expect(trigger).not.toHaveBeenCalled();
    expect(await statusOf(itemId)).toBe("deferred");
    // A deferred attempt must not inflate the shared counter.
    expect(await getDailyCount(userId, "ingestion")).toBe(limit);
  });

  test("shadow mode (not enforced) never defers, even past the limit", async () => {
    process.env.USAGE_LIMITS_ENFORCED = "false";
    const { userId, itemId } = await createItem();
    await seedCount(userId, 10_000);

    const result = await run(userId, itemId);

    expect(result).toEqual({ status: "enqueued" });
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(await statusOf(itemId)).toBe("processing");
  });

  test("a failed trigger rolls the item back to deferred and releases the slot", async () => {
    process.env.USAGE_LIMITS_ENFORCED = "true";
    const { userId, itemId } = await createItem();
    trigger.mockReset().mockRejectedValue(new Error("trigger down"));

    await expect(run(userId, itemId)).rejects.toThrow("trigger down");

    // Not stranded as `processing` (the sweep would never revisit it) and the
    // reserved slot is returned so a failed enqueue doesn't consume the allowance.
    expect(await statusOf(itemId)).toBe("deferred");
    expect(await getDailyCount(userId, "ingestion")).toBe(0);
  });

  test("skips (and releases the slot) when the item is already being processed", async () => {
    process.env.USAGE_LIMITS_ENFORCED = "true";
    const { userId, itemId } = await createItem();
    const { write } = await import("@/lib/db");
    await write.item.update({
      where: { id: itemId },
      data: { processingStatus: "processing" },
    });

    const result = await run(userId, itemId);

    expect(result).toEqual({ status: "skipped" });
    expect(trigger).not.toHaveBeenCalled();
    expect(await statusOf(itemId)).toBe("processing");
    // Reserved then released → net zero, no allowance leaked.
    expect(await getDailyCount(userId, "ingestion")).toBe(0);
  });
});
