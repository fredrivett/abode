/**
 * Shared milestone condition functions.
 * Used by both frontend and backend to determine if a milestone should be marked complete.
 * These functions are pure and don't depend on any server-only code.
 */

/**
 * Check if user has added their first tag.
 * Triggered when updating an item with userTags.
 */
export function shouldCompleteAddFirstTag(
  userTags: string[] | undefined,
): boolean {
  return userTags !== undefined && userTags.length > 0;
}

/**
 * Check if profile is complete.
 * Requires both a name (first or last) AND an avatar.
 */
export function shouldCompleteProfile(user: {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}): boolean {
  const hasName = Boolean(user.firstName || user.lastName);
  const hasAvatar = Boolean(user.avatarUrl);
  return hasName && hasAvatar;
}

/**
 * Check if item processing is complete (for see_ai_analysis milestone).
 */
export function shouldCompleteSeeAiAnalysis(
  processingStatus: string | undefined,
): boolean {
  return processingStatus === "completed";
}

/**
 * Check if room is a smart/dynamic room.
 * Used for create_dynamic_room milestone.
 */
export function shouldCompleteCreateDynamicRoom(
  roomType: string | undefined,
): boolean {
  return roomType === "smart";
}

/**
 * Gates for milestones that only make sense once something else has happened.
 * A pending milestone stays hidden until its gate opens.
 */
export type MilestoneConditional =
  | "has_article"
  | "has_item"
  | "has_first_room"
  | "has_items_to_share";

/**
 * Items a user needs before "Invite a friend" appears, so we don't ask
 * before they've properly started using abode.
 */
export const INVITE_NUDGE_MIN_ITEMS = 2;
