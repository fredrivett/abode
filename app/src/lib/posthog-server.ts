import { PostHog } from "posthog-node";
import { isDevelopment } from "@/env";

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
  // Don't initialize PostHog in development
  if (isDevelopment) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      // Because server-side functions in Next.js can be short-lived,
      // we set flushAt to 1 and flushInterval to 0 to ensure events are sent immediately
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
