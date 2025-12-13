import { PrismaClient } from "@prisma/client";

/**
 * Primary prisma client (write) and optional read-replica client.
 * Mirrors the log.limo setup to avoid connection storms during dev reloads.
 * Uses lazy initialization to avoid build-time errors when DATABASE_URL is not set.
 */

const globalForPrisma = globalThis as unknown as {
  prismaRead?: PrismaClient;
  prismaWrite?: PrismaClient;
};

const shouldLogQueries =
  process.env.NODE_ENV === "development" &&
  process.env.PRISMA_LOG_QUERIES === "true";

function createWriteClient(): PrismaClient {
  return new PrismaClient({
    log: shouldLogQueries ? ["query"] : [],
    transactionOptions: {
      timeout: 30_000,
      maxWait: 10_000,
    },
  });
}

function createReadClient(): PrismaClient {
  const readReplicaUrl = process.env.READ_REPLICA_DATABASE_URL?.trim();
  const primaryUrl = process.env.DATABASE_URL;

  return new PrismaClient({
    log: shouldLogQueries ? ["query"] : [],
    datasources: {
      db: {
        url: readReplicaUrl || primaryUrl,
      },
    },
  });
}

// Lazy initialization - only create clients when accessed
function getWriteClient(): PrismaClient {
  if (!globalForPrisma.prismaWrite) {
    globalForPrisma.prismaWrite = createWriteClient();
  }
  return globalForPrisma.prismaWrite;
}

function getReadClient(): PrismaClient {
  if (!globalForPrisma.prismaRead) {
    globalForPrisma.prismaRead = createReadClient();
  }
  return globalForPrisma.prismaRead;
}

// Export getter proxies that lazily initialize
const write = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return Reflect.get(getWriteClient(), prop);
  },
});

const read = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return Reflect.get(getReadClient(), prop);
  },
});

export { read, write };
export default write;
