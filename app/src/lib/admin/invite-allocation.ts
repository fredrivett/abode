/** Upper bound for an admin-set invite allocation (a typo guard, not a policy) */
export const MAX_INVITE_ALLOCATION = 1000;

/**
 * Parse an admin-entered invite allocation: a whole number from 0 to
 * {@link MAX_INVITE_ALLOCATION}, or null when invalid.
 */
export function parseInviteAllocation(value: unknown): number | null {
  const parsed =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed)) return null;
  if (parsed < 0 || parsed > MAX_INVITE_ALLOCATION) return null;
  return parsed;
}
