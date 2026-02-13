import { PostHog } from "posthog-node";
import { isDevelopment } from "@/env";

// Uses process.env directly instead of @/env.server to avoid the "server-only"
// import, which would prevent Trigger.dev tasks from importing this module.
let posthogClient: PostHog | null = null;

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

export function captureServerException(
  error: unknown,
  distinctId?: string,
  additionalProperties?: Record<string, unknown>,
): void {
  const client = getPostHogClient();
  if (!client) return;

  client.captureException(error, distinctId, additionalProperties);
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
