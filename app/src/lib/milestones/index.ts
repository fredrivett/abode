import "server-only";

import type { MilestoneType } from "@prisma/client";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";

const logger = createLogger("lib/milestones");

/**
 * All milestone types in display order
 */
export const MILESTONE_TYPES: MilestoneType[] = [
  "complete_profile",
  "upload_first_image",
  "save_first_url",
  "see_ai_analysis",
  "search_items",
  "add_first_tag",
  "highlight_article",
  "create_first_room",
  "create_dynamic_room",
  "share_room",
  "invite_friend",
];

/**
 * Milestone display configuration
 */
export const MILESTONE_CONFIG: Record<
  MilestoneType,
  {
    label: string;
    destination: string;
    conditional?: "has_article" | "has_item" | "has_first_room";
  }
> = {
  complete_profile: {
    label: "Complete your profile",
    destination: "/settings/account",
  },
  upload_first_image: {
    label: "Upload your first image",
    destination: "/dashboard?action=upload",
  },
  save_first_url: {
    label: "Save your first URL",
    destination: "/dashboard?action=upload",
  },
  see_ai_analysis: {
    label: "View AI analysis",
    destination: "/dashboard",
  },
  search_items: {
    label: "Search your abode",
    destination: "/dashboard?focus=search&prefix=@",
  },
  add_first_tag: {
    label: "Add your first tag",
    destination: "/dashboard",
  },
  highlight_article: {
    label: "Highlight an article",
    destination: "/dashboard",
    conditional: "has_article",
  },
  create_first_room: {
    label: "Create your first room",
    destination: "/rooms/new",
    conditional: "has_item",
  },
  create_dynamic_room: {
    label: "Create a dynamic room",
    destination: "/rooms/new",
    conditional: "has_first_room",
  },
  share_room: {
    label: "Share a room",
    destination: "/rooms",
    conditional: "has_first_room",
  },
  invite_friend: {
    label: "Invite a friend",
    destination: "/settings/invites",
  },
};

export type MilestoneStatus = {
  completed: MilestoneType[];
  pending: MilestoneType[];
  hasArticle: boolean;
};

/**
 * Get the milestone status for a user
 */
export async function getMilestoneStatus(
  userId: string,
): Promise<MilestoneStatus> {
  const [completedMilestones, articleCount, itemCount] = await Promise.all([
    db.userMilestone.findMany({
      where: { userId },
      select: { type: true },
    }),
    db.item.count({
      where: {
        userId,
        kind: "article",
      },
    }),
    db.item.count({
      where: { userId },
    }),
  ]);

  const completedSet = new Set(completedMilestones.map((m) => m.type));
  const hasArticle = articleCount > 0;
  const hasItem = itemCount > 0;

  const completed: MilestoneType[] = [];
  const pending: MilestoneType[] = [];

  const hasFirstRoom = completedSet.has("create_first_room");

  for (const type of MILESTONE_TYPES) {
    const config = MILESTONE_CONFIG[type];

    // Skip conditional milestones if condition not met
    if (config.conditional === "has_article" && !hasArticle) {
      continue;
    }
    if (config.conditional === "has_item" && !hasItem) {
      continue;
    }
    if (config.conditional === "has_first_room" && !hasFirstRoom) {
      continue;
    }

    if (completedSet.has(type)) {
      completed.push(type);
    } else {
      pending.push(type);
    }
  }

  return { completed, pending, hasArticle };
}

/**
 * Mark a milestone as complete for a user.
 * This is idempotent - calling it multiple times for the same milestone has no effect.
 * Errors are logged but not thrown to avoid breaking the main flow.
 */
export async function markMilestoneComplete(
  userId: string,
  type: MilestoneType,
): Promise<void> {
  try {
    await db.userMilestone.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type },
      update: {}, // No-op if already exists (idempotent)
    });
  } catch (err) {
    // Log but don't rethrow - milestone tracking should never break main flow
    logger.error({ err, userId, type }, `Failed to mark milestone ${type}`);
  }
}

/**
 * Check if a user has completed a specific milestone
 */
export async function hasMilestoneCompleted(
  userId: string,
  type: MilestoneType,
): Promise<boolean> {
  const milestone = await db.userMilestone.findUnique({
    where: { userId_type: { userId, type } },
  });
  return milestone !== null;
}
