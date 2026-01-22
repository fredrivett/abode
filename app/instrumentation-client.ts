import posthog from "posthog-js";
import { isDevelopment, POSTHOG_HOST, POSTHOG_KEY } from "@/env";

posthog.init(POSTHOG_KEY, {
  api_host: POSTHOG_HOST,
  // Include the defaults option for optimal behavior
  defaults: "2025-05-24",
  // Enables capturing unhandled exceptions via Error Tracking
  capture_exceptions: true,
  loaded: (posthog) => {
    if (isDevelopment) {
      posthog.opt_out_capturing();
      posthog.debug();
    }
  },
});
