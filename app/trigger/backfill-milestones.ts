/**
 * Backfill milestones for existing users
 *
 * This task analyzes existing user data and creates milestone records
 * for actions they have already completed. Can be triggered manually
 * from the Trigger.dev dashboard.
 *
 * Milestones that can be backfilled:
 * - complete_profile: (firstName OR lastName) AND avatarUrl set
 * - upload_first_image: Has item with kind='image'
 * - save_first_url: Has item with kind='article' or kind='twitter'
 * - add_first_tag: Has item with userTags.length > 0
 * - highlight_article: Has ArticleHighlight record
 * - create_first_room: Has any room
 * - create_dynamic_room: Has room with type='smart'
 * - invite_friend: Has sent Invite with origin='user'
 *
 * Milestones that CANNOT be backfilled (view/action based):
 * - see_ai_analysis: Requires viewing a processed item
 * - search_items: Requires using search
 * - share_room: Requires opening share dialog on public room
 */

import type { MilestoneType } from "@prisma/client";
import { logger, task } from "@trigger.dev/sdk";
import db from "@/lib/db";

type MilestoneToCreate = {
  userId: string;
  type: MilestoneType;
};

export const backfillMilestonesTask = task({
  id: "backfill-milestones",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async () => {
    logger.info("Starting milestone backfill...");

    const milestonesToCreate: MilestoneToCreate[] = [];

    // Get all users
    const users = await db.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });

    logger.info(`Found ${users.length} users to process`);

    // Get existing milestones to avoid duplicates
    const existingMilestones = await db.userMilestone.findMany({
      select: {
        userId: true,
        type: true,
      },
    });

    const existingSet = new Set(
      existingMilestones.map((m) => `${m.userId}:${m.type}`),
    );

    const shouldCreate = (userId: string, type: MilestoneType): boolean => {
      return !existingSet.has(`${userId}:${type}`);
    };

    // 1. complete_profile: (firstName OR lastName) AND avatarUrl
    for (const user of users) {
      if ((user.firstName || user.lastName) && user.avatarUrl) {
        if (shouldCreate(user.id, "complete_profile")) {
          milestonesToCreate.push({ userId: user.id, type: "complete_profile" });
        }
      }
    }

    // 2. upload_first_image: Has item with kind='image'
    const usersWithImages = await db.item.groupBy({
      by: ["userId"],
      where: { kind: "image" },
    });
    for (const { userId } of usersWithImages) {
      if (shouldCreate(userId, "upload_first_image")) {
        milestonesToCreate.push({ userId, type: "upload_first_image" });
      }
    }

    // 3. save_first_url: Has item with kind='article' or kind='twitter'
    const usersWithUrls = await db.item.groupBy({
      by: ["userId"],
      where: { kind: { in: ["article", "twitter"] } },
    });
    for (const { userId } of usersWithUrls) {
      if (shouldCreate(userId, "save_first_url")) {
        milestonesToCreate.push({ userId, type: "save_first_url" });
      }
    }

    // 4. add_first_tag: Has item with userTags.length > 0
    const itemsWithTags = await db.item.findMany({
      where: {
        NOT: { userTags: { equals: [] } },
      },
      select: { userId: true },
      distinct: ["userId"],
    });
    for (const { userId } of itemsWithTags) {
      if (shouldCreate(userId, "add_first_tag")) {
        milestonesToCreate.push({ userId, type: "add_first_tag" });
      }
    }

    // 5. highlight_article: Has ArticleHighlight record
    const usersWithHighlights = await db.articleHighlight.groupBy({
      by: ["userId"],
    });
    for (const { userId } of usersWithHighlights) {
      if (shouldCreate(userId, "highlight_article")) {
        milestonesToCreate.push({ userId, type: "highlight_article" });
      }
    }

    // 6. create_first_room: Has any room
    const usersWithRooms = await db.room.groupBy({
      by: ["userId"],
    });
    for (const { userId } of usersWithRooms) {
      if (shouldCreate(userId, "create_first_room")) {
        milestonesToCreate.push({ userId, type: "create_first_room" });
      }
    }

    // 7. create_dynamic_room: Has room with type='smart'
    const usersWithSmartRooms = await db.room.groupBy({
      by: ["userId"],
      where: { type: "smart" },
    });
    for (const { userId } of usersWithSmartRooms) {
      if (shouldCreate(userId, "create_dynamic_room")) {
        milestonesToCreate.push({ userId, type: "create_dynamic_room" });
      }
    }

    // 8. invite_friend: Has sent an invite (origin: user)
    const usersWithInvites = await db.invite.groupBy({
      by: ["inviterId"],
      where: {
        origin: "user",
        inviterId: { not: null },
      },
    });
    for (const { inviterId } of usersWithInvites) {
      if (inviterId && shouldCreate(inviterId, "invite_friend")) {
        milestonesToCreate.push({ userId: inviterId, type: "invite_friend" });
      }
    }

    // Summary before creating
    const countByType: Record<string, number> = {};
    for (const m of milestonesToCreate) {
      countByType[m.type] = (countByType[m.type] || 0) + 1;
    }

    logger.info(
      `Milestones to create: ${JSON.stringify(countByType)} (total: ${milestonesToCreate.length})`,
    );

    if (milestonesToCreate.length === 0) {
      logger.info("No milestones to create. All users are up to date.");
      return {
        usersProcessed: users.length,
        milestonesCreated: 0,
        countByType: {},
      };
    }

    // Create milestones in batches
    const BATCH_SIZE = 100;
    let created = 0;

    for (let i = 0; i < milestonesToCreate.length; i += BATCH_SIZE) {
      const batch = milestonesToCreate.slice(i, i + BATCH_SIZE);

      await db.userMilestone.createMany({
        data: batch,
        skipDuplicates: true,
      });

      created += batch.length;

      if (created % 500 === 0 || created === milestonesToCreate.length) {
        logger.info(`Progress: ${created}/${milestonesToCreate.length} created`);
      }
    }

    logger.info(`Backfill complete: ${created} milestones created`);

    return {
      usersProcessed: users.length,
      milestonesCreated: created,
      countByType,
    };
  },
});
