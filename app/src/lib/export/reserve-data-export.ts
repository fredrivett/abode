import db from "@/lib/db";
import { MAX_EXPORTS_PER_DAY } from "./constants";
import { dataExportSnapshotSelect } from "./snapshot";

const DAY_MS = 24 * 60 * 60 * 1000;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type CreatedExport = Awaited<ReturnType<typeof createExport>>;

/**
 * Takes the per-user export lock for the rest of `tx`. Anything that checks
 * and then creates a user's export must hold it, so it can't interleave.
 */
export async function lockUserDataExports(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`data-export:${userId}`}, 0))`;
}

export type ReserveDataExportResult =
  | { status: "created"; dataExport: CreatedExport }
  | { status: "in_progress"; exportId: string }
  | { status: "daily_limit" };

function createExport(tx: Tx, userId: string) {
  return tx.dataExport.create({
    data: { userId },
    select: dataExportSnapshotSelect,
  });
}

/**
 * Creates a pending export for the user unless one is already in progress or
 * they've hit the daily cap (failed runs don't count toward it). The checks and the insert run under a per-user
 * advisory lock (held until the transaction ends), so concurrent requests
 * queue behind each other instead of all seeing room and all creating one.
 */
export async function reserveDataExport(
  userId: string,
  now = new Date(),
): Promise<ReserveDataExportResult> {
  return db.$transaction(async (tx) => {
    await lockUserDataExports(tx, userId);

    const active = await tx.dataExport.findFirst({
      where: { userId, status: { in: ["pending", "exporting"] } },
      select: { id: true },
    });
    if (active) return { status: "in_progress", exportId: active.id };

    // Failed runs don't count: a failure on our side (e.g. the worker was
    // down) mustn't lock the user out of retrying for a day
    const recent = await tx.dataExport.count({
      where: {
        userId,
        status: { not: "failed" },
        createdAt: { gte: new Date(now.getTime() - DAY_MS) },
      },
    });
    if (recent >= MAX_EXPORTS_PER_DAY) return { status: "daily_limit" };

    return { status: "created", dataExport: await createExport(tx, userId) };
  });
}
