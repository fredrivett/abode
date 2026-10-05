/**
 * Pure email → username parsing, kept apart from the availability lookups in
 * `generate-from-email.ts` so client components can use it without pulling the
 * Prisma client into the browser bundle.
 *
 * Algorithm:
 * 1. Take local part (before @)
 * 2. Strip +alias if present
 * 3. Remove dots
 * 4. Remove invalid chars (keep a-z, 0-9, _)
 * 5. Truncate to 12 chars (leave room for numbers)
 * 6. If <2 letters, prefix with "user_"
 */

export const MAX_BASE_LENGTH = 12; // Leave room for suffix numbers

/**
 * Parses an email into a base username candidate.
 * This is a pure function that doesn't check availability.
 */
export function parseEmailToUsername(email: string): string {
  // Get local part (before @)
  let base = email.split("@")[0] || "";

  // Strip Gmail-style aliases (everything after +)
  base = base.split("+")[0] || "";

  // Remove dots (Gmail ignores them)
  base = base.replace(/\./g, "");

  // Lowercase
  base = base.toLowerCase();

  // Remove non-alphanumeric/underscore characters
  base = base.replace(/[^a-z0-9_]/g, "");

  // Truncate to max length
  base = base.slice(0, MAX_BASE_LENGTH);

  // Ensure minimum letters (at least 2)
  const letterCount = (base.match(/[a-z]/g) || []).length;
  if (letterCount < 2) {
    base = `user_${base}`;
    base = base.slice(0, MAX_BASE_LENGTH);
  }

  // Ensure minimum length
  if (base.length < 2) {
    base = "user";
  }

  return base;
}
