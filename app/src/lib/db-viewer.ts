import type { Prisma } from "@prisma/client";
import { type DbTransactionClient, write } from "@/lib/db";

type DbClient = typeof write;

/**
 * The restricted role created in the abode_app_rls migration: it can't bypass
 * row level security, and its policies only ever match the viewer's own rows.
 */
export const RESTRICTED_ROLE = "abode_app";

/**
 * Switch the current transaction to the restricted role and record its viewer
 * (null = anonymous). Both settings are transaction-local, so they never leak
 * onto a pooled connection's next transaction.
 */
function setViewer(
  client: DbClient | DbTransactionClient,
  viewerId: string | null,
): Prisma.PrismaPromise<unknown> {
  return client.$executeRaw`SELECT set_config('role', ${RESTRICTED_ROLE}, true), set_config('abode.viewer_id', ${viewerId ?? ""}, true)`;
}

/**
 * A client whose every query runs as the restricted role on behalf of
 * `viewerId`, so the database itself refuses other users' rows even if a
 * query forgets its `userId` filter. Each operation runs in its own short
 * transaction with the viewer set first.
 *
 * Use `viewerTransaction` for multi-statement work; calling `$transaction` on
 * this client isn't supported.
 */
export function forViewer(viewerId: string | null, base: DbClient = write) {
  return base.$extends({
    name: "abode-viewer",
    query: {
      async $allOperations({ args, query }) {
        const [, result] = await base.$transaction([
          setViewer(base, viewerId),
          query(args),
        ]);
        return result;
      },
    },
  });
}

/**
 * An interactive transaction run as the restricted role on behalf of
 * `viewerId`: the viewer is set once, then every query on `tx` is bound by
 * row level security.
 */
export function viewerTransaction<T>({
  viewerId,
  run,
  base = write,
}: {
  viewerId: string | null;
  run: (tx: DbTransactionClient) => Promise<T>;
  base?: DbClient;
}): Promise<T> {
  return base.$transaction(async (tx) => {
    await setViewer(tx, viewerId);
    return run(tx);
  });
}
