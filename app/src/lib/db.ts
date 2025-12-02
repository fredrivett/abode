import { PrismaClient } from "@prisma/client";

/**
 * Primary prisma client (write) and optional read-replica client.
 * Mirrors the log.limo setup to avoid connection storms during dev reloads.
 */

const globalForPrisma = globalThis as unknown as {
  prismaRead?: PrismaClient;
  prismaWrite?: PrismaClient;
};

const shouldLogQueries =
  process.env.NODE_ENV === "development" &&
  process.env.PRISMA_LOG_QUERIES === "true";

// Primary client
const write =
  globalForPrisma.prismaWrite ??
  new PrismaClient({
    log: shouldLogQueries ? ["query"] : [],
    transactionOptions: {
      timeout: 30_000,
      maxWait: 10_000,
    },
  });

// Optional read-replica client
const readReplicaUrl = process.env.READ_REPLICA_DATABASE_URL?.trim();
const primaryUrl = process.env.DATABASE_URL;

const read =
  globalForPrisma.prismaRead ??
  new PrismaClient({
    log: shouldLogQueries ? ["query"] : [],
    datasources: {
      db: {
        url: readReplicaUrl || primaryUrl,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaWrite = write;
  globalForPrisma.prismaRead = read;
}

export { read, write };
export default write;
