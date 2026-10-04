import { Prisma } from "@prisma/client";

/**
 * Prisma error codes meaning the query never reached the database, so running
 * it again can't double-apply a write:
 * - P1001: can't reach the database server
 * - P1002: server reached but the connection attempt timed out
 * - P2024: timed out waiting for a connection from the pool
 *
 * P1017 (server closed the connection) is deliberately absent — the query may
 * already have executed.
 */
const NEVER_SENT_ERROR_CODES = new Set(["P1001", "P1002", "P2024"]);

/** Backoff before each retry; a pooler blip typically clears within seconds */
export const DB_RETRY_DELAYS_MS = [250, 1000] as const;

/** True when a Prisma error means the query never ran and is safe to retry. */
export function isTransientConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    NEVER_SENT_ERROR_CODES.has(error.code)
  );
}

/**
 * Run `operation`, retrying with backoff when it fails with a transient
 * connection error. Any other error (or the last transient one) is rethrown.
 */
export async function retryTransientConnectionErrors<T>(
  operation: () => Promise<T>,
  {
    delaysMs = DB_RETRY_DELAYS_MS,
    sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  }: {
    delaysMs?: readonly number[];
    sleep?: (ms: number) => Promise<unknown>;
  } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const delay = delaysMs[attempt];
      if (delay === undefined || !isTransientConnectionError(error)) {
        throw error;
      }
      await sleep(delay);
    }
  }
}

/**
 * Retries every query (model operations and raw SQL) that fails before reaching
 * the database — a brief pooler outage otherwise surfaces as a 500 on whatever
 * request was in flight (e.g. image proxy lookups while a grid loads).
 * Opening an interactive `$transaction` isn't an operation, so it isn't retried;
 * queries inside one already hold a connection, so these errors don't arise.
 *
 * A factory, not a module-level constant: `defineExtension` throws in the
 * browser, and `@/lib/db` is reachable from some client bundles (its clients
 * are only ever created server-side).
 */
export function connectionRetryExtension() {
  return Prisma.defineExtension({
    name: "connection-retry",
    query: {
      $allOperations({ args, query }) {
        return retryTransientConnectionErrors(() => query(args));
      },
    },
  });
}
