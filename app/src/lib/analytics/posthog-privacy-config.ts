import type { PostHogConfig } from "posthog-js";
import { CONTENT_QUERY_PARAMS } from "./mask-url";
import { REPLAY_PRIVACY_OPTIONS } from "./replay-privacy";
import { scrubEvent } from "./scrub-event";

/** Privacy settings spread into `posthog.init` — see README "External services" */
export const POSTHOG_PRIVACY_CONFIG = {
  session_recording: REPLAY_PRIVACY_OPTIONS,
  before_send: scrubEvent,
  // PostHog's own URL masking, applied where `before_send` can't reach
  mask_personal_data_properties: true,
  custom_personal_data_properties: CONTENT_QUERY_PARAMS,
} satisfies Partial<PostHogConfig>;
