/**
 * Client-safe environment variables
 * These can be imported from both server and client components
 *
 * Note: Only NEXT_PUBLIC_* vars are available on the client.
 * Uses fallbacks since we don't want to crash the user's browser.
 */

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

export const isDevelopment = process.env.NODE_ENV === "development";
