import { defineConfig } from "@playwright/test";

// Extension E2E. The spec launches its own persistent context with the built
// extension loaded (channel "chromium" so MV3 service workers load headless), so
// there's no shared browser fixture or webServer here.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.spec.ts",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
});
