/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";

const trigger = vi.hoisted(() => vi.fn());
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger } }));

import { resumeDeferredItems } from "@/lib/items/resume-deferred-items";
import { backgroundLimitFor, getDailyCount } from "@/lib/usage-limits";

describe("resumeDeferredItems", () => {
  const originalFlag = process.env.USAGE_LIMITS_ENFORCED;

  beforeEach(async () => {
    await resetTestDatabase();
    trigger.mockReset().mockResolvedValue({ id: "run_1" });
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.USAGE_LIMITS_ENFORCED;
    else process.env.USAGE_LIMITS_ENFORCED = originalFlag;
  });

  const createUser = async () => {
    const { write } = await import("@/lib/db");
    const user = await write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `rd-${crypto.randomUUID()}@example.com`,
      },
    });
    return user.id;
  };

  /** Create `n` deferred book items for a user, oldest-first by createdAt. */
  const seedDeferredBooks = async (
    userId: string,
    n: number,
  ): Promise<string[]> => {
    const { write } = await import("@/lib/db");
    const base = Date.now() - n * 1000;
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const item = await write.item.create({
        data: {
          id: crypto.randomUUID(),
          user: { connect: { id: userId } },
          kind: "book",
          title: `Book ${i}`,
          description: "desc",
          processingStatus: "deferred",
          createdAt: new Date(base + i * 1000),
          bookDetails: { create: { authors: ["Author"] } },
        },
        select: { id: true },
      });
      ids.push(item.id);
    }
    return ids;
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

  test("resumes only up to the remaining headroom, leaving the rest deferred", async () => {
    process.env.USAGE_LIMITS_ENFORCED = "true";
    const userId = await createUser();
    // Headroom = 120 − 118 = 2 slots.
    await seedCount(userId, backgroundLimitFor("ingestion") - 2);
    const ids = await seedDeferredBooks(userId, 5);

    const result = await resumeDeferredItems();

    expect(result.enqueued).toBe(2);
    expect(result.stillDeferred).toBe(3);
    expect(trigger).toHaveBeenCalledTimes(2);
    // Oldest two enqueued (→ processing); the rest stay parked.
    expect(await statusOf(ids[0])).toBe("processing");
    expect(await statusOf(ids[1])).toBe("processing");
    expect(await statusOf(ids[2])).toBe("deferred");
    expect(await statusOf(ids[4])).toBe("deferred");
    expect(await getDailyCount(userId, "ingestion")).toBe(
      backgroundLimitFor("ingestion"),
    );
  });

  test("resumes the enrich-item task with sourceText rebuilt from the book", async () => {
    process.env.USAGE_LIMITS_ENFORCED = "true";
    const userId = await createUser();
    const [id] = await seedDeferredBooks(userId, 1);

    await resumeDeferredItems();

    expect(trigger).toHaveBeenCalledTimes(1);
    const [taskId, payload] = trigger.mock.calls[0];
    expect(taskId).toBe("enrich-item");
    expect(payload).toMatchObject({
      itemId: id,
      userId,
      sourceText: "Book 0 Author desc",
    });
  });

  test("shadow mode resumes everything regardless of count", async () => {
    process.env.USAGE_LIMITS_ENFORCED = "false";
    const userId = await createUser();
    await seedCount(userId, 10_000);
    const ids = await seedDeferredBooks(userId, 3);

    const result = await resumeDeferredItems();

    expect(result.enqueued).toBe(3);
    expect(trigger).toHaveBeenCalledTimes(3);
    for (const id of ids) expect(await statusOf(id)).toBe("processing");
  });
});
