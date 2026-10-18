import posthog from "posthog-js";

/**
 * The browser's PostHog distinct id, so an event the server records for this
 * visitor joins their visit (and its funnels). Undefined when PostHog isn't
 * running, e.g. blocked.
 */
export function posthogVisitorId(): string | undefined {
  return posthog.__loaded ? posthog.get_distinct_id() : undefined;
}
