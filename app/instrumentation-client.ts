import posthog from "posthog-js";
import { BUILD_SHA, isDevelopment, POSTHOG_HOST, POSTHOG_KEY } from "@/env";
import { POSTHOG_PRIVACY_CONFIG } from "@/lib/analytics/posthog-privacy-config";
import { createLogger } from "@/lib/logger.client";
import { getDisplayMode } from "@/lib/pwa/display-mode";
import { captureInstallPrompt } from "@/lib/pwa/install-prompt";

const log = createLogger("posthog");

// Before hydration: Chromium can fire beforeinstallprompt as soon as the page loads
captureInstallPrompt();

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Include the defaults option for optimal behavior
    defaults: "2025-05-24",
    // Enables capturing unhandled exceptions via Error Tracking
    capture_exceptions: true,
    // Disable performance/web vitals in dev to prevent Turbopack dynamic import warning
    capture_performance: !isDevelopment,
    // Replays show how abode is used, not what people save
    ...POSTHOG_PRIVACY_CONFIG,
    loaded: (posthog) => {
      // Attach the build SHA to every event so incidents link to the deploy.
      if (BUILD_SHA) {
        posthog.register({ build_sha: BUILD_SHA });
      }
      // Splits every event by installed app vs browser tab
      posthog.register({ display_mode: getDisplayMode() });
      window.addEventListener("appinstalled", () =>
        posthog.capture("app_installed"),
      );
      if (isDevelopment) {
        posthog.opt_out_capturing();
        posthog.debug();
      }
    },
  });
} else if (!isDevelopment) {
  log.warn("PostHog key not set, analytics disabled");
}
