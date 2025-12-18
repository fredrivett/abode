import type { FullConfig } from "@playwright/test";
import { startTestDatabase } from "../test/db-container";

/**
 * Playwright global setup - starts the test database container.
 * The connection string is stored in an environment variable file
 * that gets passed to the webServer process.
 */
async function globalSetup(_config: FullConfig) {
  const connectionString = await startTestDatabase();

  // Set environment variables for the webServer process
  // These will be available when Playwright starts the Next.js dev server
  process.env.DATABASE_URL = connectionString;
  process.env.DIRECT_URL = connectionString;

  // Store connection string for teardown and tests
  process.env.TEST_DATABASE_URL = connectionString;
}

export default globalSetup;
