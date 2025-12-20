/**
 * Get display name from user profile data.
 *
 * Priority:
 * 1. "First Last" if both exist
 * 2. "First" if only firstName exists
 * 3. "@username" as fallback
 *
 * Note: lastName alone is skipped - we fall back to username.
 */
export function getDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  return `@${user.username}`;
}
