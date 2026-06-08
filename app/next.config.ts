import { execSync } from "node:child_process";
import { withPostHogConfig } from "@posthog/nextjs-config";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import "./src/env";

let revision: string;
try {
  revision = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
} catch {
  revision = crypto.randomUUID();
}

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Expose the build's git SHA to client + server so analytics/errors can be
  // linked back to the deploy that produced them.
  env: {
    NEXT_PUBLIC_BUILD_SHA: revision,
  },
  // @trigger.dev/core uses `z.ZodSchema`, which zod v4 dropped from the
  // top-level export. Trigger ships its own nested zod v3, so externalizing
  // these packages lets Node resolve to that copy at runtime instead of
  // letting webpack dedupe to the app's zod v4.
  serverExternalPackages: ["@trigger.dev/sdk", "@trigger.dev/core"],
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "55321",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "55321",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "www.gravatar.com",
      },
    ],
  },
};

const serwistConfig = withSerwist(nextConfig);

// Upload source maps to PostHog at build time so production stack traces are
// readable. Only enabled when BOTH the personal API key and project ID are
// present — the wrapper validates projectId eagerly and would crash the build
// if it were missing — so local and token-less CI builds are unaffected. Set
// POSTHOG_API_KEY + POSTHOG_PROJECT_ID in the Vercel project to activate.
const posthogApiKey = process.env.POSTHOG_API_KEY;
const posthogProjectId = process.env.POSTHOG_PROJECT_ID;

export default posthogApiKey && posthogProjectId
  ? withPostHogConfig(serwistConfig, {
      personalApiKey: posthogApiKey,
      projectId: posthogProjectId,
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      sourcemaps: {
        enabled: true,
        deleteAfterUpload: true,
        releaseVersion: revision,
      },
    })
  : serwistConfig;
