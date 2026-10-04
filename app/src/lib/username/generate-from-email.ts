/**
 * Generate an available username from an email address: parse a base candidate
 * (see {@link parseEmailToUsername}), then append an incrementing number until
 * one is free. Server-only — client code imports the pure parser directly.
 */

import { read } from "@/lib/db";
import { validateUsername } from "./index";
import { MAX_BASE_LENGTH, parseEmailToUsername } from "./parse-email";

const MAX_SUFFIX_ATTEMPTS = 999;

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
