/**
 * Derives user initials for avatar display.
 *
 * Tries first + last name initials, then the first character of a fallback
 * string (stripping a leading `@`), then the first two characters of the
 * email username, and finally falls back to `"U"`.
 */
export function getInitials({
  firstName,
  lastName,
  fallback,
  email,
}: {
  firstName?: string | null;
  lastName?: string | null;
  fallback?: string | null;
  email?: string | null;
}) {
  const first = firstName?.trim()?.[0];
  const last = lastName?.trim()?.[0];
  const fromNames = [first, last].filter(Boolean).join("").toUpperCase();
  if (fromNames) return fromNames;

  // Strip leading @ from fallback (e.g. when displayName is "@username")
  const cleanedFallback = fallback?.trim()?.replace(/^@/, "");
  const fallbackInitial = cleanedFallback?.[0]?.toUpperCase();
  if (fallbackInitial) return fallbackInitial;

  // For email-only users, use first 2 chars of username part
  const emailUsername = email?.split("@")[0]?.trim();
  if (emailUsername && emailUsername.length >= 2) {
    return emailUsername.slice(0, 2).toUpperCase();
  }
  if (emailUsername) {
    return emailUsername[0].toUpperCase();
  }

  return "U";
}
