import posthog from "posthog-js";
import { BUILD_SHA, isDevelopment, POSTHOG_HOST, POSTHOG_KEY } from "@/env";
import { createLogger } from "@/lib/logger.client";

const log = createLogger("posthog");

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Include the defaults option for optimal behavior
    defaults: "2025-05-24",
    // Enables capturing unhandled exceptions via Error Tracking
    capture_exceptions: true,
    // Disable performance/web vitals in dev to prevent Turbopack dynamic import warning
    capture_performance: !isDevelopment,
    loaded: (posthog) => {
      // Attach the build SHA to every event so incidents link to the deploy.
      if (BUILD_SHA) {
        posthog.register({ build_sha: BUILD_SHA });
      }
      if (isDevelopment) {
        posthog.opt_out_capturing();
        posthog.debug();
      }
    },
  });
} else if (!isDevelopment) {
  log.warn("PostHog key not set, analytics disabled");
}
