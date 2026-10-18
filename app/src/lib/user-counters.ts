import type { DbClient, DbTransactionClient } from "@/lib/db";

/**
 * Adjust a user's item and storage counters. Goes through
 * `abode.adjust_user_counters` because the restricted abode_app role can't
 * update those columns directly — and the function only lets a user's request
 * adjust that user's own counters. Pass the transaction the item write runs
 * in, so the counters move atomically with it.
 */
export function adjustUserCounters(
  client: DbClient | DbTransactionClient,
  {
    userId,
    items,
    bytes,
  }: { userId: string; items: number; bytes: number | bigint },
) {
  const byteDelta =
    typeof bytes === "bigint" ? bytes : BigInt(Math.trunc(bytes));
  return client.$executeRaw`SELECT abode.adjust_user_counters(${userId}::uuid, ${items}::integer, ${byteDelta}::bigint)`;
}
