/**
 * Reserved usernames that cannot be registered.
 *
 * Categories:
 * - App routes (to prevent URL conflicts)
 * - Brand terms (to prevent impersonation)
 * - Generic terms (valuable/confusing usernames)
 * - Offensive terms (small hardcoded list)
 */

// App routes - prevent namespace conflicts
const APP_ROUTES = [
  "dashboard",
  "settings",
  "account",
  "rooms",
  "help",
  "dev",
  "login",
  "signup",
  "logout",
  "auth",
  "api",
  "admin",
  "moderator",
  "mod",
  "new",
  "edit",
  "delete",
  "create",
  "update",
  "onboarding",
  "callback",
  "webhook",
  "webhooks",
];

// Brand terms - prevent impersonation
const BRAND_TERMS = [
  "abode",
  "support",
  "help",
  "staff",
  "team",
  "official",
  "verified",
  "system",
  "bot",
  "root",
  "null",
  "undefined",
];

// Generic/valuable terms
const GENERIC_TERMS = [
  "user",
  "users",
  "profile",
  "profiles",
  "me",
  "you",
  "home",
  "about",
  "contact",
  "terms",
  "privacy",
  "tos",
  "legal",
  "faq",
  "blog",
  "news",
  "status",
  "explore",
  "search",
  "notifications",
  "messages",
  "inbox",
  "feed",
  "discover",
  "invite",
  "invites",
];

// Offensive terms - small hardcoded list of worst offenders
const OFFENSIVE_TERMS = [
  "fuck",
  "shit",
  "ass",
  "bitch",
  "cunt",
  "dick",
  "cock",
  "pussy",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "slut",
  "whore",
];

export const RESERVED_WORDS = new Set(
  [...APP_ROUTES, ...BRAND_TERMS, ...GENERIC_TERMS, ...OFFENSIVE_TERMS].map(
    (w) => w.toLowerCase(),
  ),
);

/**
 * Checks if a username is reserved (case-insensitive).
 */
export function isReservedWord(username: string): boolean {
  return RESERVED_WORDS.has(username.toLowerCase());
}

/**
 * Checks if a username contains any offensive terms as substrings.
 */
export function containsOffensiveContent(username: string): boolean {
  const lower = username.toLowerCase();
  return OFFENSIVE_TERMS.some((term) => lower.includes(term));
}
