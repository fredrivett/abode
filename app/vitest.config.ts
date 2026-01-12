import path from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      // Vitest/Vite can resolve `server-only` to its throwing entrypoint so alias to Next's empty shim for unit tests
      "server-only": path.resolve(
        dirname,
        "./node_modules/next/dist/compiled/server-only/empty.js",
      ),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "html", "lcov"],
    },
    projects: [
      {
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, ".storybook") }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
      {
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
        },
      },
      {
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
          name: "integration",
          environment: "node",
          globals: true,
          setupFiles: ["./vitest.setup.db.ts"],
          include: ["src/**/*.integration.{test,spec}.{ts,tsx}"],
          testTimeout: 30000,
          hookTimeout: 120000, // Container startup can take time
          fileParallelism: false, // DB tests run sequentially
        },
      },
    ],
  },
});
