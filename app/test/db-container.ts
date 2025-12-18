import { execSync } from "node:child_process";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

let container: StartedPostgreSqlContainer | null = null;

/**
 * Starts a PostgreSQL test container with pgvector support.
 * Runs Prisma migrations to create the schema.
 * Returns the connection string for the database.
 */
export async function startTestDatabase(): Promise<string> {
  // Use pgvector image since schema uses vector types
  container = await new PostgreSqlContainer("pgvector/pgvector:pg16")
    .withDatabase("test_db")
    .withUsername("test_user")
    .withPassword("test_password")
    .start();

  const connectionString = container.getConnectionUri();

  // Run Prisma migrations
  execSync("bunx prisma migrate deploy", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      DIRECT_URL: connectionString,
    },
  });

  return connectionString;
}

/**
 * Stops the test database container.
 */
export async function stopTestDatabase(): Promise<void> {
  if (container) {
    await container.stop();
    container = null;
  }
}

/**
 * Gets the current test container instance.
 */
export function getTestContainer(): StartedPostgreSqlContainer | null {
  return container;
}

/**
 * Resets all tables in the test database (useful between tests).
 * Truncates all tables while respecting foreign key constraints.
 */
export async function resetTestDatabase(): Promise<void> {
  if (!container) {
    throw new Error("Test database not initialized");
  }

  // Dynamic import to avoid loading Prisma at module level
  const { write } = await import("@/lib/db");

  // Get all table names (excluding Prisma migrations table)
  const tables = await write.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename != '_prisma_migrations'
  `;

  if (tables.length > 0) {
    const tableNames = tables.map((t) => `"${t.tablename}"`).join(", ");
    await write.$executeRawUnsafe(
      `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`,
    );
  }
}
