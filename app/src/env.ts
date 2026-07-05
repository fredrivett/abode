/**
 * Client-safe environment variables
 * These can be imported from both server and client components
 *
 * Note: Only NEXT_PUBLIC_* vars are available on the client.
 * Uses fallbacks since we don't want to crash the user's browser.
 */

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// Git SHA of the running build, injected via next.config.ts `env`.
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA;

// Local dev only: current git branch, injected via next.config.ts `env`.
// Undefined in production builds.
export const GIT_BRANCH = process.env.NEXT_PUBLIC_GIT_BRANCH;

export const isDevelopment = process.env.NODE_ENV === "development";
