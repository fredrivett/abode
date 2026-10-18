/// <reference types="vitest/globals" />

import { resetTestDatabase } from "@app/vitest.setup.db";
import { SHARED_TABLES, SYSTEM_ONLY_TABLES } from "./rls-tables";

/**
 * The restricted `abode_app` role (abode_app_rls migration) must only ever see
 * and change its viewer's own rows, in every table, whatever the query says.
 * The owner gets a row in every table; another user and an anonymous viewer
 * then query every table unfiltered and must get nothing back, and writes that
 * reach across users must fail.
 */

type Seeded = Awaited<ReturnType<typeof seed>>;

async function seed() {
  const { write } = await import("@/lib/db");
  const ownerId = crypto.randomUUID();
  const strangerId = crypto.randomUUID();
  await write.user.create({
    data: { id: ownerId, email: "owner@example.com", username: "owner" },
  });
  await write.user.create({
    data: {
      id: strangerId,
      email: "stranger@example.com",
      username: "stranger",
    },
  });

  // Kinds don't gate detail rows, so one item can hold every kind of detail
  const item = await write.item.create({
    data: {
      userId: ownerId,
      kind: "image",
      sourceType: "upload",
      processingStatus: "completed",
      title: "Private",
      fileKey: `${ownerId}/photo.jpg`,
      articleDetails: { create: {} },
      imageDetails: { create: { ocrText: "secret" } },
      twitterDetails: { create: { tweetId: "1", authorUsername: "a" } },
      instagramDetails: {
        create: { postId: "p", mediaType: "post", authorUsername: "a" },
      },
      videoDetails: { create: { platform: "youtube", videoId: "v" } },
      productDetails: { create: {} },
      bookDetails: { create: {} },
      noteDetails: { create: { content: "secret" } },
      documentPages: {
        create: {
          position: 0,
          fileKey: `${ownerId}/page.jpg`,
          originalFileKey: `${ownerId}/page.jpg`,
          width: 1,
          height: 1,
        },
      },
      locations: { create: { userId: ownerId, source: "exif", city: "X" } },
      mediaAnalyses: {
        create: { userId: ownerId, fileKey: `${ownerId}/photo.jpg` },
      },
      visualVectors: { create: { userId: ownerId, model: "clip" } },
      textVectors: { create: { userId: ownerId, model: "text" } },
      highlights: {
        create: { userId: ownerId, startOffset: 0, endOffset: 1, text: "s" },
      },
    },
    select: { id: true },
  });
  const room = await write.room.create({
    data: {
      userId: ownerId,
      name: "Private room",
      slug: "private-room",
      type: "manual",
      roomItems: { create: { itemId: item.id } },
      embedReferrers: { create: { referrerUrl: "https://example.com/" } },
    },
    select: { id: true },
  });
  await write.noteDraft.create({ data: { userId: ownerId, content: "draft" } });
  await write.activityLog.create({
    data: { userId: ownerId, type: "item_view" },
  });
  await write.userMilestone.create({
    data: { userId: ownerId, type: "complete_profile" },
  });
  await write.usageDaily.create({
    data: { userId: ownerId, day: new Date(), bucket: "search", count: 1 },
  });
  await write.personalAccessToken.create({
    data: {
      userId: ownerId,
      name: "token",
      tokenHash: "hash",
      tokenPrefix: "abode_pat_x",
    },
  });
  await write.itemImport.create({
    data: { userId: ownerId, source: "literal" },
  });
  const dataExport = await write.dataExport.create({
    data: {
      userId: ownerId,
      parts: {
        create: {
          position: 1,
          fileKey: `${ownerId}/export.zip`,
          sizeBytes: BigInt(1),
        },
      },
    },
    select: { id: true },
  });
  await write.invite.create({
    data: {
      email: "friend@example.com",
      token: "invite-token",
      origin: "user",
      inviterId: ownerId,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  await write.waitlistEntry.create({ data: { email: "waiting@example.com" } });
  await write.visualEmbeddingStats.create({ data: { model: "clip", n: 1 } });

  return {
    ownerId,
    strangerId,
    itemId: item.id,
    roomId: room.id,
    exportId: dataExport.id,
  };
}

async function publicTables(): Promise<string[]> {
  const { write } = await import("@/lib/db");
  const rows = await write.$queryRaw<{ name: string }[]>`
    SELECT c.relname AS name FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname`;
  return rows.map((row) => row.name);
}

/** Rows per table that `viewerId` can see, querying each with no filter at all */
async function visibleCounts(viewerId: string | null) {
  const { viewerTransaction } = await import("@/lib/db-viewer");
  const tables = (await publicTables()).filter(
    (table) => !SYSTEM_ONLY_TABLES.has(table),
  );
  return viewerTransaction({
    viewerId,
    run: async (tx) => {
      const counts: Record<string, number> = {};
      for (const table of tables) {
        // Table names come from pg_class, not input
        const [row] = await tx.$queryRawUnsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM public."${table}"`,
        );
        counts[table] = row.n;
      }
      return counts;
    },
  });
}

describe("abode_app row level security", () => {
  let ids: Seeded;

  beforeAll(async () => {
    await resetTestDatabase();
    ids = await seed();
  });

  it("shows the owner their rows in every table", async () => {
    const counts = await visibleCounts(ids.ownerId);
    const empty = Object.entries(counts)
      .filter(([, n]) => n === 0)
      .map(([table]) => table);
    expect(empty).toEqual([]);
  });

  it("shows another user none of them", async () => {
    const counts = await visibleCounts(ids.strangerId);
    const leaked = Object.entries(counts).filter(
      ([table, n]) =>
        n > 0 &&
        !SHARED_TABLES.has(table) &&
        // their own users row
        !(table === "users" && n === 1),
    );
    expect(leaked).toEqual([]);
    expect(counts.users).toBe(1);
  });

  it("shows an anonymous viewer nothing", async () => {
    const counts = await visibleCounts(null);
    const leaked = Object.entries(counts).filter(
      ([table, n]) => n > 0 && !SHARED_TABLES.has(table),
    );
    expect(leaked).toEqual([]);
  });

  it("never lets the role read system-only tables", async () => {
    const { viewerTransaction } = await import("@/lib/db-viewer");
    await expect(
      viewerTransaction({
        viewerId: ids.ownerId,
        run: (tx) =>
          tx.$queryRaw`SELECT count(*) FROM public."_prisma_migrations"`,
      }),
    ).rejects.toThrow(/permission denied/);
    const waitlist = await viewerTransaction({
      viewerId: ids.ownerId,
      run: (tx) => tx.waitlistEntry.count(),
    });
    expect(waitlist).toBe(0);
  });

  describe("writes across users", () => {
    it("can't change or delete another user's rows", async () => {
      const { forViewer } = await import("@/lib/db-viewer");
      const { write } = await import("@/lib/db");
      const stranger = forViewer(ids.strangerId);

      expect(
        (
          await stranger.item.updateMany({
            where: { id: ids.itemId },
            data: { title: "pwned" },
          })
        ).count,
      ).toBe(0);
      expect(
        (await stranger.room.deleteMany({ where: { id: ids.roomId } })).count,
      ).toBe(0);
      expect(
        (await stranger.roomItem.deleteMany({ where: { roomId: ids.roomId } }))
          .count,
      ).toBe(0);

      const item = await write.item.findUniqueOrThrow({
        where: { id: ids.itemId },
      });
      expect(item.title).toBe("Private");
      expect(await write.room.count({ where: { id: ids.roomId } })).toBe(1);
    });

    it("can't create rows owned by, or hung off, another user", async () => {
      const { forViewer } = await import("@/lib/db-viewer");
      const stranger = forViewer(ids.strangerId);
      const ownRoom = await stranger.room.create({
        data: {
          userId: ids.strangerId,
          name: "Mine",
          slug: "mine",
          type: "manual",
        },
        select: { id: true },
      });

      const attempts = {
        "an item for someone else": stranger.item.create({
          data: { userId: ids.ownerId, kind: "note", sourceType: "compose" },
        }),
        "their item in my room": stranger.roomItem.create({
          data: { roomId: ownRoom.id, itemId: ids.itemId },
        }),
        "a location on their item": stranger.itemLocation.create({
          data: {
            userId: ids.strangerId,
            itemId: ids.itemId,
            source: "manual",
          },
        }),
        "a highlight on their item": stranger.articleHighlight.create({
          data: {
            userId: ids.strangerId,
            itemId: ids.itemId,
            startOffset: 0,
            endOffset: 1,
            text: "x",
          },
        }),
        "a detail row on their item": stranger.itemNoteDetails.upsert({
          where: { itemId: ids.itemId },
          create: { itemId: ids.itemId, content: "x" },
          update: { content: "x" },
        }),
      };
      for (const [name, attempt] of Object.entries(attempts)) {
        await expect(attempt, name).rejects.toThrow();
      }
    });
  });

  describe("system-written tables", () => {
    it("are read-only or append-only even for their owner", async () => {
      const { forViewer } = await import("@/lib/db-viewer");
      const owner = forViewer(ids.ownerId);

      // Spend-cap counters: a user can't reset their own limits
      expect(
        (await owner.usageDaily.updateMany({ data: { count: 0 } })).count,
      ).toBe(0);
      expect((await owner.usageDaily.deleteMany({})).count).toBe(0);
      // Activity is append-only
      expect((await owner.activityLog.deleteMany({})).count).toBe(0);
      await owner.activityLog.create({
        data: { userId: ids.ownerId, type: "item_view" },
      });
      // Imports/exports: started by the user, then owned by the job
      expect(
        (await owner.dataExport.updateMany({ data: { status: "failed" } }))
          .count,
      ).toBe(0);
      expect((await owner.dataExport.deleteMany({})).count).toBe(0);
      expect(
        (await owner.itemImport.updateMany({ data: { status: "failed" } }))
          .count,
      ).toBe(0);
    });
  });

  describe("the viewer's own data", () => {
    it("works normally, relations included", async () => {
      const { forViewer } = await import("@/lib/db-viewer");
      const owner = forViewer(ids.ownerId);

      const items = await owner.item.findMany({
        include: { noteDetails: true, roomItems: true, locations: true },
      });
      expect(items).toHaveLength(1);
      expect(items[0].noteDetails?.content).toBe("secret");
      expect(items[0].roomItems).toHaveLength(1);

      const created = await owner.item.create({
        data: {
          userId: ids.ownerId,
          kind: "note",
          sourceType: "compose",
          noteDetails: { create: { content: "new" } },
        },
        select: { id: true },
      });
      await owner.roomItem.create({
        data: { roomId: ids.roomId, itemId: created.id },
      });
      expect(
        await owner.roomItem.count({ where: { roomId: ids.roomId } }),
      ).toBe(2);
    });

    it("can edit profile fields but not privileged ones", async () => {
      const { forViewer } = await import("@/lib/db-viewer");
      const owner = forViewer(ids.ownerId);

      await owner.user.update({
        where: { id: ids.ownerId },
        data: { bio: "hello" },
      });
      for (const data of [
        { isAdmin: true },
        { storageUsedBytes: BigInt(0) },
        { inviteAllocation: 999 },
        { email: "takeover@example.com" },
      ]) {
        await expect(
          owner.user.update({ where: { id: ids.ownerId }, data }),
          JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? `${v}` : v)),
        ).rejects.toThrow(/permission denied/);
      }
    });
  });
});
