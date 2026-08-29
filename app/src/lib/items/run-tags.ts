/**
 * Trigger.dev run tags that tie a background run back to the item it processes
 * and that item's owner, so runs are filterable in the dashboard (and, later,
 * queryable via the Management API) by item or by user.
 *
 * Following Trigger's documented `type_id` convention (e.g. `user_123456`). Pure
 * string helpers with no env/SDK imports so they're safe to use anywhere,
 * including inside Trigger tasks.
 */

/** Tag identifying every run that processes a given item. */
export function itemTag(itemId: string): string {
  return `item_${itemId}`;
}

/** Tag identifying every run enqueued on behalf of a given user. */
export function userTag(userId: string): string {
  return `user_${userId}`;
}

/** The standard tag set for a run processing `itemId` owned by `userId`. */
export function itemRunTags({
  itemId,
  userId,
}: {
  itemId: string;
  userId: string;
}): string[] {
  return [itemTag(itemId), userTag(userId)];
}
