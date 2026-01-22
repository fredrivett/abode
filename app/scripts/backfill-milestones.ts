// biome-ignore-all lint/suspicious/noConsole: CLI script requires console output
/**
 * Backfill milestones for existing users
 *
 * This script analyzes existing user data and creates milestone records
 * for actions they have already completed.
 *
 * Run with: bun run scripts/backfill-milestones.ts
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
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type MilestoneToCreate = {
  userId: string;
  type: MilestoneType;
};

async function backfillMilestones() {
  console.log("Starting milestone backfill...\n");

  const milestonesToCreate: MilestoneToCreate[] = [];

  // Get all users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  });

  console.log(`Found ${users.length} users to process\n`);

  // Get existing milestones to avoid duplicates
  const existingMilestones = await prisma.userMilestone.findMany({
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
  const usersWithImages = await prisma.item.groupBy({
    by: ["userId"],
    where: { kind: "image" },
  });
  for (const { userId } of usersWithImages) {
    if (shouldCreate(userId, "upload_first_image")) {
      milestonesToCreate.push({ userId, type: "upload_first_image" });
    }
  }

  // 3. save_first_url: Has item with kind='article' or kind='twitter'
  const usersWithUrls = await prisma.item.groupBy({
    by: ["userId"],
    where: { kind: { in: ["article", "twitter"] } },
  });
  for (const { userId } of usersWithUrls) {
    if (shouldCreate(userId, "save_first_url")) {
      milestonesToCreate.push({ userId, type: "save_first_url" });
    }
  }

  // 4. add_first_tag: Has item with userTags.length > 0
  // userTags is a JSON array, we need to check for non-empty arrays
  const itemsWithTags = await prisma.item.findMany({
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
  const usersWithHighlights = await prisma.articleHighlight.groupBy({
    by: ["userId"],
  });
  for (const { userId } of usersWithHighlights) {
    if (shouldCreate(userId, "highlight_article")) {
      milestonesToCreate.push({ userId, type: "highlight_article" });
    }
  }

  // 6. create_first_room: Has any room
  const usersWithRooms = await prisma.room.groupBy({
    by: ["userId"],
  });
  for (const { userId } of usersWithRooms) {
    if (shouldCreate(userId, "create_first_room")) {
      milestonesToCreate.push({ userId, type: "create_first_room" });
    }
  }

  // 7. create_dynamic_room: Has room with type='smart'
  const usersWithSmartRooms = await prisma.room.groupBy({
    by: ["userId"],
    where: { type: "smart" },
  });
  for (const { userId } of usersWithSmartRooms) {
    if (shouldCreate(userId, "create_dynamic_room")) {
      milestonesToCreate.push({ userId, type: "create_dynamic_room" });
    }
  }

  // 8. invite_friend: Has sent an invite (origin: user)
  const usersWithInvites = await prisma.invite.groupBy({
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
  console.log("Milestones to create:");
  const countByType: Record<string, number> = {};
  for (const m of milestonesToCreate) {
    countByType[m.type] = (countByType[m.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(countByType).sort()) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`\nTotal: ${milestonesToCreate.length} milestones\n`);

  if (milestonesToCreate.length === 0) {
    console.log("No milestones to create. All users are up to date.");
    return;
  }

  // Create milestones in batches
  const BATCH_SIZE = 100;
  let created = 0;

  for (let i = 0; i < milestonesToCreate.length; i += BATCH_SIZE) {
    const batch = milestonesToCreate.slice(i, i + BATCH_SIZE);

    await prisma.userMilestone.createMany({
      data: batch,
      skipDuplicates: true,
    });

    created += batch.length;
    console.log(`Progress: ${created}/${milestonesToCreate.length}`);
  }

  console.log(`\nBackfill complete. Created ${created} milestones.`);
}

backfillMilestones()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
