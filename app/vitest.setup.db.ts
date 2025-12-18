import { afterAll, beforeAll } from "vitest";
import { startTestDatabase, stopTestDatabase } from "./test/db-container";

// Re-export for use in tests
export { resetTestDatabase } from "./test/db-container";

// Global setup/teardown hooks for integration tests
beforeAll(async () => {
  const connectionString = await startTestDatabase();

  // Set environment variables for Prisma
  process.env.DATABASE_URL = connectionString;
  process.env.DIRECT_URL = connectionString;
}, 120000); // 2 minute timeout for container startup + migrations

afterAll(async () => {
  await stopTestDatabase();
});
