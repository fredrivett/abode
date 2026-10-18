/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";

// users.item_count / storage_used_bytes aren't updatable by abode_app, so item
// writes adjust them through abode.adjust_user_counters — which lets a user's
// request touch only that user's counters, and background jobs anyone's
describe("adjustUserCounters", () => {
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    await resetTestDatabase();
    const { systemDb } = await import("@/lib/db");
    alice = crypto.randomUUID();
    bob = crypto.randomUUID();
    await systemDb.user.createMany({
      data: [
        { id: alice, email: "alice@example.com", username: "alice" },
        { id: bob, email: "bob@example.com", username: "bob" },
      ],
    });
  });

  const counters = async (userId: string) => {
    const { systemDb } = await import("@/lib/db");
    const user = await systemDb.user.findUniqueOrThrow({
      where: { id: userId },
      select: { itemCount: true, storageUsedBytes: true },
    });
    return { items: user.itemCount, bytes: Number(user.storageUsedBytes) };
  };

  it("adjusts the viewer's own counters, atomically with the item write", async () => {
    const { systemDb } = await import("@/lib/db");
    const { viewerTransaction } = await import("@/lib/db-viewer");
    const { adjustUserCounters } = await import("@/lib/user-counters");
    const before = await counters(alice);

    await viewerTransaction({
      base: systemDb,
      viewerId: alice,
      run: async (tx) => {
        await tx.item.create({
          data: { userId: alice, kind: "note", sourceType: "compose" },
        });
        await adjustUserCounters(tx, { userId: alice, items: 1, bytes: 500 });
      },
    });

    expect(await counters(alice)).toEqual({
      items: before.items + 1,
      bytes: before.bytes + 500,
    });
  });

  it("rolls the item write back when the counter adjustment fails", async () => {
    const { systemDb } = await import("@/lib/db");
    const { viewerTransaction } = await import("@/lib/db-viewer");
    const { adjustUserCounters } = await import("@/lib/user-counters");
    const before = await counters(alice);
    const itemsBefore = await systemDb.item.count({ where: { userId: alice } });

    await expect(
      viewerTransaction({
        base: systemDb,
        viewerId: alice,
        run: async (tx) => {
          await tx.item.create({
            data: { userId: alice, kind: "note", sourceType: "compose" },
          });
          // Refused (not alice's counters), after the item insert
          await adjustUserCounters(tx, { userId: bob, items: 1, bytes: 1 });
        },
      }),
    ).rejects.toThrow(/own viewer's counters/);

    expect(await systemDb.item.count({ where: { userId: alice } })).toBe(
      itemsBefore,
    );
    expect(await counters(alice)).toEqual(before);
  });

  it("refuses a user's request adjusting someone else's counters", async () => {
    const { systemDb } = await import("@/lib/db");
    const { viewerTransaction } = await import("@/lib/db-viewer");
    const { adjustUserCounters } = await import("@/lib/user-counters");
    const before = await counters(bob);

    for (const viewerId of [alice, null]) {
      await expect(
        viewerTransaction({
          base: systemDb,
          viewerId,
          run: (tx) =>
            adjustUserCounters(tx, { userId: bob, items: -100, bytes: -1 }),
        }),
      ).rejects.toThrow(/own viewer's counters/);
    }
    expect(await counters(bob)).toEqual(before);
  });

  it("still can't set the counter columns directly", async () => {
    const { systemDb } = await import("@/lib/db");
    const { forViewer } = await import("@/lib/db-viewer");
    await expect(
      forViewer(alice, systemDb).user.update({
        where: { id: alice },
        data: { storageUsedBytes: BigInt(0) },
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it("clamps at zero rather than failing when counters have drifted", async () => {
    const { systemDb } = await import("@/lib/db");
    const { viewerTransaction } = await import("@/lib/db-viewer");
    const { adjustUserCounters } = await import("@/lib/user-counters");
    // Drift alice's counters down to nothing (as the reconcile job could)
    await systemDb.user.update({
      where: { id: alice },
      data: { itemCount: 0, storageUsedBytes: BigInt(100) },
    });

    await viewerTransaction({
      base: systemDb,
      viewerId: alice,
      run: (tx) =>
        adjustUserCounters(tx, { userId: alice, items: -1, bytes: -5000 }),
    });

    expect(await counters(alice)).toEqual({ items: 0, bytes: 0 });
  });

  it("only lets a user's request move one item's worth at a time", async () => {
    const { systemDb } = await import("@/lib/db");
    const { viewerTransaction } = await import("@/lib/db-viewer");
    const { adjustUserCounters } = await import("@/lib/user-counters");
    const before = await counters(alice);

    for (const change of [
      { items: -100, bytes: 0 },
      { items: 2, bytes: 0 },
      { items: 1, bytes: -(2 * 1024 ** 3) },
      { items: 1, bytes: -(1024 ** 3) - 1 },
    ]) {
      await expect(
        viewerTransaction({
          base: systemDb,
          viewerId: alice,
          run: (tx) => adjustUserCounters(tx, { userId: alice, ...change }),
        }),
      ).rejects.toThrow(/one item at a time/);
    }
    expect(await counters(alice)).toEqual(before);

    // Exactly at the limit is allowed
    await viewerTransaction({
      base: systemDb,
      viewerId: alice,
      run: (tx) =>
        adjustUserCounters(tx, { userId: alice, items: 1, bytes: 1024 ** 3 }),
    });
    expect(await counters(alice)).toEqual({
      items: before.items + 1,
      bytes: before.bytes + 1024 ** 3,
    });
  });

  it("lets background jobs on the owner connection adjust anyone", async () => {
    const { systemDb } = await import("@/lib/db");
    const { adjustUserCounters } = await import("@/lib/user-counters");
    const before = await counters(bob);

    await adjustUserCounters(systemDb, {
      userId: bob,
      items: 2,
      bytes: BigInt(1024),
    });

    expect(await counters(bob)).toEqual({
      items: before.items + 2,
      bytes: before.bytes + 1024,
    });
  });
});
