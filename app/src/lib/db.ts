import { PrismaClient } from "@prisma/client";
import type { ITXClientDenyList } from "@prisma/client/runtime/library";
import { isDevelopment } from "@/env";
import { connectionRetryExtension } from "@/lib/db-retry";
import { forViewer, viewerTransaction } from "@/lib/db-viewer";
import {
  currentViewerFrame,
  isRlsEnforced,
  type ViewerFrame,
} from "@/lib/viewer-context";

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
  }).$extends(connectionRetryExtension());
}

export type DbClient = ReturnType<typeof createWriteClient>;

/**
 * The `tx` handed to `write.$transaction(async (tx) => …)`. Use this (not
 * `Prisma.TransactionClient`, which types the un-extended client) for helpers
 * that accept either a transaction or the base client.
 */
export type DbTransactionClient = Omit<DbClient, ITXClientDenyList>;

/** Options accepted by an interactive `$transaction(fn, options)` */
export type TransactionOptions = Parameters<DbClient["$transaction"]>[1];

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
  }).$extends(connectionRetryExtension());
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

type RestrictedClient = ReturnType<typeof forViewer>;
type FrameClients = {
  viewerId: string | null;
  byBase: Map<DbClient, RestrictedClient>;
};
// Kept on the request's frame, so they're collected with the request
const frameClients = new WeakMap<ViewerFrame, FrameClients>();

/** The frame's restricted client for `base`, built once per request */
function restrictedClient(
  frame: ViewerFrame,
  base: DbClient,
): RestrictedClient {
  let clients = frameClients.get(frame);
  // The viewer goes from anonymous to the authenticated user once per request
  if (!clients || clients.viewerId !== frame.viewerId) {
    clients = { viewerId: frame.viewerId, byBase: new Map() };
    frameClients.set(frame, clients);
  }
  let client = clients.byBase.get(base);
  if (!client) {
    client = forViewer(frame.viewerId, base);
    clients.byBase.set(base, client);
  }
  return client;
}

/**
 * The client for whoever the current code is acting for. Inside a request
 * frame (see `@/lib/viewer-context`) with RLS_ENFORCED on, every query runs as
 * the restricted abode_app role, so the database itself refuses other users'
 * rows — and a frame whose viewer was never recorded is anonymous and sees
 * nothing. Outside a frame (background jobs, scripts), or with the flag off,
 * it's the owner connection, exactly as before.
 */
function contextual(getBase: () => DbClient): DbClient {
  return new Proxy({} as DbClient, {
    get(_, prop) {
      const base = getBase();
      const frame = currentViewerFrame();
      if (!frame || !isRlsEnforced()) return Reflect.get(base, prop);

      if (prop === "$transaction") {
        return (arg: unknown, options?: TransactionOptions) => {
          if (typeof arg !== "function") {
            throw new Error(
              "Batch $transaction([...]) isn't supported for a viewer; use $transaction(async (tx) => …)",
            );
          }
          return viewerTransaction({
            viewerId: frame.viewerId,
            base,
            run: arg as (tx: DbTransactionClient) => Promise<unknown>,
            options,
          });
        };
      }
      return Reflect.get(restrictedClient(frame, base), prop);
    },
  });
}

/** Lazily initialised owner connections — these bypass row level security */
const ownerWrite = new Proxy({} as DbClient, {
  get(_, prop) {
    return Reflect.get(getWriteClient(), prop);
  },
});

const ownerRead = new Proxy({} as DbClient, {
  get(_, prop) {
    return Reflect.get(getReadClient(), prop);
  },
});

const write = contextual(getWriteClient);
const read = contextual(getReadClient);

/**
 * The owner connection, always — it bypasses row level security. Only for
 * work that genuinely spans users or runs as the system (background jobs,
 * admin, signup, public pages, cross-user checks like "is this username
 * taken?"). Everything acting for a signed-in user uses `db`.
 */
export { ownerRead as systemRead, ownerWrite as systemDb, read, write };
export default write;
