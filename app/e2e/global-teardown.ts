import type { FullConfig } from "@playwright/test";
import { stopTestDatabase } from "../test/db-container";

/**
 * Playwright global teardown - stops the test database container.
 */
async function globalTeardown(_config: FullConfig) {
  await stopTestDatabase();
}

export default globalTeardown;
