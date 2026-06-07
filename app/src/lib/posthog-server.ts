import { PostHog } from "posthog-node";
import { isDevelopment } from "@/env";

// Uses process.env directly instead of @/env.server to avoid the "server-only"
// import, which would prevent Trigger.dev tasks from importing this module.
let posthogClient: PostHog | null = null;

/**
 * Returns the singleton PostHog client for server-side analytics.
 *
 * Returns `null` in development or when the API key is missing.
 * Configured with immediate flushing to avoid lost events in short-lived
 * server functions.
 */
export function getPostHogClient() {
  if (isDevelopment) {
    return null;
  }

  if (!posthogClient) {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      return null;
    }

    posthogClient = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      // Because server-side functions in Next.js can be short-lived,
      // we set flushAt to 1 and flushInterval to 0 to ensure events are sent immediately
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

/**
 * Sends an exception to PostHog for server-side error tracking.
 *
 * No-ops silently when the PostHog client is unavailable.
 */
export function captureServerException(
  error: unknown,
  distinctId?: string,
  additionalProperties?: Record<string, unknown>,
): void {
  const client = getPostHogClient();
  if (!client) return;

  client.captureException(error, distinctId, {
    build_sha: process.env.NEXT_PUBLIC_BUILD_SHA,
    ...additionalProperties,
  });
}

/**
 * Flushes pending events and shuts down the PostHog client.
 */
export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
