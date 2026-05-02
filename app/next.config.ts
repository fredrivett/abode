import { execSync } from "node:child_process";
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

export default withSerwist(nextConfig);
