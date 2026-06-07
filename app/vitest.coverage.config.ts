import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Standalone unit-coverage config. The main vitest.config.ts defines a
// Storybook project whose browser plugin is loaded whenever --coverage is set
// (even with --project unit), which fails in CI/headless. This config runs only
// the unit suite so coverage can be collected reliably.
const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      "@app": path.resolve(dirname, "."),
      "server-only": path.resolve(
        dirname,
        "./node_modules/next/dist/compiled/server-only/empty.js",
      ),
    },
  },
  test: {
    name: "unit",
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://localhost" },
    },
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["src/**/*.integration.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text-summary", "text"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/**/*.stories.{ts,tsx}"],
    },
  },
});
