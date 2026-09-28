/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import type { CaptureSource, ItemKind } from "@prisma/client";
import { getMilestoneStatus } from "@/lib/milestones";

describe("getMilestoneStatus", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const createUser = async () => {
    const { write } = await import("@/lib/db");
    return write.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `milestones-${crypto.randomUUID()}@example.com`,
      },
    });
  };

  const createItems = async ({
    userId,
    kind = "image",
    captureSource = "web",
    count = 1,
  }: {
    userId: string;
    kind?: ItemKind;
    captureSource?: CaptureSource;
    count?: number;
  }) => {
    const { write } = await import("@/lib/db");
    await write.item.createMany({
      data: Array.from({ length: count }, () => ({
        userId,
        kind,
        captureSource,
      })),
    });
  };

  const recordedMilestones = async (userId: string) => {
    const { read } = await import("@/lib/db");
    const rows = await read.userMilestone.findMany({
      where: { userId },
      select: { type: true },
    });
    return rows.map((row) => row.type);
  };

  const completedTypes = (
    status: Awaited<ReturnType<typeof getMilestoneStatus>>,
  ) => status.completed.map((m) => m.type);

  test("a new user sees the ungated milestones only", async () => {
    const user = await createUser();

    const status = await getMilestoneStatus(user.id);

    expect(status.completed).toEqual([]);
    expect(status.pending).toContain("write_first_note");
    expect(status.pending).toContain("add_first_book");
    expect(status.pending).not.toContain("save_from_phone");
    expect(status.pending).not.toContain("create_first_room");
  });

  test("offers saving from your phone once the user has an item", async () => {
    const user = await createUser();
    await createItems({ userId: user.id });

    const status = await getMilestoneStatus(user.id);

    expect(status.pending).toContain("save_from_phone");
  });

  test.each([
    { milestone: "write_first_note", item: { kind: "note" } },
    { milestone: "add_first_book", item: { kind: "book" } },
    { milestone: "save_from_phone", item: { captureSource: "share_target" } },
  ] as const)(
    "completes $milestone from the user's items",
    async ({ milestone, item }) => {
      const user = await createUser();
      await createItems({ userId: user.id, ...item });

      const status = await getMilestoneStatus(user.id);

      expect(completedTypes(status)).toContain(milestone);
      expect(status.pending).not.toContain(milestone);
      expect(await recordedMilestones(user.id)).toContain(milestone);
    },
  );

  test("keeps the original completion time of a derived milestone", async () => {
    const { write } = await import("@/lib/db");
    const user = await createUser();
    const completedAt = new Date("2026-01-01T00:00:00Z");
    await write.userMilestone.create({
      data: { userId: user.id, type: "add_first_book", completedAt },
    });
    await createItems({ userId: user.id, kind: "book" });

    const status = await getMilestoneStatus(user.id);

    expect(
      status.completed.find((m) => m.type === "add_first_book")?.completedAt,
    ).toEqual(completedAt);
  });
});
