/**
 * Generate a username suggestion from an email address.
 *
 * Algorithm:
 * 1. Take local part (before @)
 * 2. Strip +alias if present
 * 3. Remove dots
 * 4. Remove invalid chars (keep a-z, 0-9, _)
 * 5. Truncate to 12 chars (leave room for numbers)
 * 6. If <2 letters, prefix with "user_"
 * 7. Check availability, append incrementing number if taken
 */

import { read } from "@/lib/db";
import { validateUsername } from "./index";

const MAX_BASE_LENGTH = 12; // Leave room for suffix numbers
const MAX_SUFFIX_ATTEMPTS = 999;

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

/**
 * Checks if a username is available in the database.
 */
async function isUsernameAvailable(username: string): Promise<boolean> {
  const existing = await read.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });
  return !existing;
}

/**
 * Generates an available username from an email address.
 * Returns the first available username (base, base1, base2, etc.)
 */
export async function generateUsernameFromEmail(
  email: string,
): Promise<string> {
  const base = parseEmailToUsername(email);

  // Try base username first
  let candidate = base;
  let suffix = 1;

  while (suffix <= MAX_SUFFIX_ATTEMPTS) {
    const validation = validateUsername(candidate);

    if (validation.valid) {
      const available = await isUsernameAvailable(candidate);
      if (available) {
        return candidate;
      }
    }

    // Try with incrementing suffix
    candidate = `${base}${suffix}`;
    suffix++;
  }

  // Fallback: use timestamp-based suffix
  const fallback = `${base.slice(0, 8)}_${Date.now().toString(36).slice(-4)}`;
  return fallback;
}

/**
 * Finds the next available username given a base.
 * Used when a user's preferred username is taken.
 */
export async function findNextAvailableUsername(
  baseUsername: string,
): Promise<string> {
  const base = baseUsername.slice(0, MAX_BASE_LENGTH).toLowerCase();
  let candidate = base;
  let suffix = 1;

  while (suffix <= MAX_SUFFIX_ATTEMPTS) {
    const validation = validateUsername(candidate);

    if (validation.valid) {
      const available = await isUsernameAvailable(candidate);
      if (available) {
        return candidate;
      }
    }

    candidate = `${base}${suffix}`;
    suffix++;
  }

  // Fallback
  return `${base.slice(0, 8)}_${Date.now().toString(36).slice(-4)}`;
}
