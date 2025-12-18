import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? "github" : "html",
  // Global setup/teardown for test database
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // Increase timeout for initial setup (container startup + migrations)
  timeout: 60000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3300",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:3300",
        reuseExistingServer: !process.env.CI,
        // Pass database environment variables to the dev server
        env: {
          DATABASE_URL: process.env.DATABASE_URL || "",
          DIRECT_URL: process.env.DIRECT_URL || "",
        },
      },
});
