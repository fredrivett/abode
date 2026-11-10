import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { getBasePort } from "./src/lib/dev-port";

const authFile = path.join(__dirname, "e2e/.auth/user.json");

const basePort = getBasePort();
// Offset +5 is assigned to the shadow DB in config.toml (Prisma concept only, never bound at runtime)
const e2eServerPort = basePort + 5;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? "github" : "html",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  timeout: 60000,
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${e2eServerPort}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/.*\.auth\.spec\.ts/, /.*\.treck\.spec\.ts/],
      dependencies: ["setup"],
    },
    {
      name: "chromium-authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
      testMatch: /.*\.auth\.spec\.ts/,
      testIgnore: [/.*\.treck\.spec\.ts/],
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "bun run dev",
    url: `http://localhost:${e2eServerPort}`,
    reuseExistingServer: false,
    env: {
      ABODE_PORT: String(e2eServerPort),
      // Own build dir so this server doesn't fight a running `bun run dev`
      // over `.next/dev/lock`
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: process.env.DATABASE_URL || "",
      DIRECT_URL: process.env.DIRECT_URL || "",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      RESEND_API_KEY: process.env.RESEND_API_KEY || "",
      LOCAL_SMTP_PORT: process.env.LOCAL_SMTP_PORT || "",
      // CI sets this so e2e exercises API routes running as abode_app (RLS)
      RLS_ENFORCED: process.env.RLS_ENFORCED || "",
    },
  },
});
