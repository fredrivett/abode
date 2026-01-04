import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  // Include the defaults option for optimal behavior
  defaults: "2025-05-24",
  // Enables capturing unhandled exceptions via Error Tracking
  capture_exceptions: true,
  loaded: (posthog) => {
    if (process.env.NODE_ENV === "development") {
      posthog.opt_out_capturing();
      posthog.debug();
    }
  },
});
