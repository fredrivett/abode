import "server-only";

import type { ItemKind, MilestoneType } from "@prisma/client";
import db from "@/lib/db";
import { createLogger } from "@/lib/logger.server";
import type { MilestoneConditional } from "@/lib/milestones/conditions";

const logger = createLogger("lib/milestones");

/**
 * All milestone types in display order
 */
export const MILESTONE_TYPES: MilestoneType[] = [
  "complete_profile",
  "upload_first_image",
  "save_first_url",
  "write_first_note",
  "scan_first_document",
  "add_first_book",
  "save_from_phone",
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
    conditional?: MilestoneConditional;
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
  write_first_note: {
    label: "Write your first note",
    // The note composer sits at the top of the dashboard grid
    destination: "/dashboard",
  },
  scan_first_document: {
    label: "Scan your first document",
    // Opens the scanner straight away (see OpenScannerOnLoad)
    destination: "/dashboard?action=scan",
  },
  add_first_book: {
    label: "Add your first book",
    // Books are saved by pasting a link to one (e.g. Goodreads, Amazon)
    destination: "/dashboard?action=upload",
  },
  save_from_phone: {
    label: "Save from your phone",
    destination: "/help/saving-from-your-phone",
    conditional: "has_item",
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
  completed: Array<{ type: MilestoneType; completedAt: Date }>;
  pending: MilestoneType[];
  hasArticle: boolean;
};

/**
 * Get the milestone status for a user.
 *
 * Also completes milestones that are satisfied by what the user has saved
 * (see the `derived` map below) but weren't recorded when it happened.
 */
export async function getMilestoneStatus(
  userId: string,
): Promise<MilestoneStatus> {
  const [completedMilestones, kindCounts, sharedItem] = await Promise.all([
    db.userMilestone.findMany({
      where: { userId },
      select: { type: true, completedAt: true },
    }),
    db.item.groupBy({
      by: ["kind"],
      where: { userId },
      _count: { _all: true },
    }),
    db.item.findFirst({
      where: { userId, captureSource: "share_target" },
      select: { id: true },
    }),
  ]);

  const completedMap = new Map(
    completedMilestones.map((m) => [m.type, m.completedAt]),
  );
  const hasKind = (kind: ItemKind) =>
    kindCounts.some((row) => row.kind === kind && row._count._all > 0);
  const itemCount = kindCounts.reduce((sum, row) => sum + row._count._all, 0);
  const hasArticle = hasKind("article");

  // Completed by the items themselves rather than the request that created
  // them: books are only recognised by a background task after the save, and
  // this also credits users who did these before the milestone existed
  const derived: Partial<Record<MilestoneType, boolean>> = {
    write_first_note: hasKind("note"),
    add_first_book: hasKind("book"),
    save_from_phone: sharedItem !== null,
  };
  const newlyDerived = MILESTONE_TYPES.filter(
    (type) => derived[type] && !completedMap.has(type),
  );
  await Promise.all(
    newlyDerived.map((type) => markMilestoneComplete(userId, type)),
  );
  for (const type of newlyDerived) {
    completedMap.set(type, new Date());
  }

  const conditionMet: Record<MilestoneConditional, boolean> = {
    has_article: hasArticle,
    has_item: itemCount > 0,
    has_first_room: completedMap.has("create_first_room"),
  };

  const completed: Array<{ type: MilestoneType; completedAt: Date }> = [];
  const pending: MilestoneType[] = [];

  for (const type of MILESTONE_TYPES) {
    // Skip conditional milestones if condition not met
    const { conditional } = MILESTONE_CONFIG[type];
    if (conditional && !conditionMet[conditional]) {
      continue;
    }

    const completedAt = completedMap.get(type);
    if (completedAt) {
      completed.push({ type, completedAt });
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
 *
 * Note: This upsert runs on every trigger (e.g., every item view for see_ai_analysis).
 * At 50K+ DAU, consider optimizing with read-first or caching to reduce write load.
 */
export async function markMilestoneComplete(
  userId: string,
  type: MilestoneType,
): Promise<void> {
  logger.info({ userId, type }, `Attempting to mark milestone ${type}`);
  try {
    const result = await db.userMilestone.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type },
      update: {}, // No-op if already exists (idempotent)
    });
    logger.info(
      { userId, type, milestoneId: result.id },
      `Successfully marked milestone ${type}`,
    );
  } catch (err) {
    // Log but don't rethrow - milestone tracking should never break main flow
    logger.error({ err, userId, type }, `Failed to mark milestone ${type}`);
  }
}
