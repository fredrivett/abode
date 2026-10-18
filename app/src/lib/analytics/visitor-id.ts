import posthog from "posthog-js";

/**
 * The browser's PostHog distinct id, so an event the server records for this
 * visitor joins their visit (and its funnels). Undefined when PostHog isn't
 * running (e.g. blocked) or the visitor opted out, so the server's event
 * stays personless.
 */
export function posthogVisitorId(): string | undefined {
  if (!posthog.__loaded || posthog.has_opted_out_capturing()) return undefined;
  return posthog.get_distinct_id();
}
