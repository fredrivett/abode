import { PrismaClient } from "@prisma/client";
import type { ITXClientDenyList } from "@prisma/client/runtime/library";
import { isDevelopment } from "@/env";
import { connectionRetryExtension } from "@/lib/db-retry";

/**
 * Primary prisma client (write) and optional read-replica client.
 * Mirrors the log.limo setup to avoid connection storms during dev reloads.
 * Uses lazy initialization to avoid build-time errors when DATABASE_URL is not set.
 */

const globalForPrisma = globalThis as unknown as {
  prismaRead?: DbClient;
  prismaWrite?: DbClient;
};

const shouldLogQueries =
  isDevelopment && process.env.PRISMA_LOG_QUERIES === "true";

/**
 * Connection pool size per Prisma client.
 * Keeps individual clients from consuming too many connections,
 * leaving room for other serverless function instances.
 * Configurable via DATABASE_CONNECTION_LIMIT env var.
 */
const CONNECTION_LIMIT = Number.parseInt(
  process.env.DATABASE_CONNECTION_LIMIT || "5",
  10,
);

function createWriteClient() {
  const baseUrl = process.env.DATABASE_URL || "";
  const separator = baseUrl.includes("?") ? "&" : "?";
  const urlWithLimit = baseUrl.includes("connection_limit")
    ? baseUrl
    : `${baseUrl}${separator}connection_limit=${CONNECTION_LIMIT}`;

  return new PrismaClient({
    log: shouldLogQueries ? ["query"] : [],
    datasources: {
      db: {
        url: urlWithLimit,
      },
    },
    transactionOptions: {
      timeout: 30_000,
      maxWait: 10_000,
    },
  }).$extends(connectionRetryExtension);
}

type DbClient = ReturnType<typeof createWriteClient>;

/**
 * The `tx` handed to `write.$transaction(async (tx) => …)`. Use this (not
 * `Prisma.TransactionClient`, which types the un-extended client) for helpers
 * that accept either a transaction or the base client.
 */
export type DbTransactionClient = Omit<DbClient, ITXClientDenyList>;

function createReadClient() {
  const readReplicaUrl = process.env.READ_REPLICA_DATABASE_URL?.trim();
  const primaryUrl = process.env.DATABASE_URL;
  const baseUrl = readReplicaUrl || primaryUrl || "";
  const separator = baseUrl.includes("?") ? "&" : "?";
  const urlWithLimit = baseUrl.includes("connection_limit")
    ? baseUrl
    : `${baseUrl}${separator}connection_limit=${CONNECTION_LIMIT}`;

  return new PrismaClient({
    log: shouldLogQueries ? ["query"] : [],
    datasources: {
      db: {
        url: urlWithLimit,
      },
    },
  }).$extends(connectionRetryExtension);
}

// Lazy initialization - only create clients when accessed
function getWriteClient(): DbClient {
  if (!globalForPrisma.prismaWrite) {
    globalForPrisma.prismaWrite = createWriteClient();
  }
  return globalForPrisma.prismaWrite;
}

function getReadClient(): DbClient {
  if (!globalForPrisma.prismaRead) {
    globalForPrisma.prismaRead = createReadClient();
  }
  return globalForPrisma.prismaRead;
}

// Export getter proxies that lazily initialize
const write = new Proxy({} as DbClient, {
  get(_, prop) {
    return Reflect.get(getWriteClient(), prop);
  },
});

const read = new Proxy({} as DbClient, {
  get(_, prop) {
    return Reflect.get(getReadClient(), prop);
  },
});

export { read, write };
export default write;
