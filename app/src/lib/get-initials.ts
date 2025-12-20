export function getInitials({
  firstName,
  lastName,
  fallback,
}: {
  firstName?: string | null;
  lastName?: string | null;
  fallback?: string | null;
}) {
  const first = firstName?.trim()?.[0];
  const last = lastName?.trim()?.[0];
  const fromNames = [first, last].filter(Boolean).join("").toUpperCase();
  if (fromNames) return fromNames;

  // Strip leading @ from fallback (e.g. when displayName is "@username")
  const cleanedFallback = fallback?.trim()?.replace(/^@/, "");
  const fallbackInitial = cleanedFallback?.[0]?.toUpperCase();
  if (fallbackInitial) return fallbackInitial;

  return "U";
}
