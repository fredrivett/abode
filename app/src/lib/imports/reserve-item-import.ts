import type { ImportSource } from "@prisma/client";
import db from "@/lib/db";
import { ACTIVE_IMPORT_STATUSES } from "./constants";

export type ReserveItemImportResult =
  | { status: "created"; importId: string }
  | { status: "in_progress"; importId: string };

/**
 * Creates the user's import unless one is already in progress: `importing`
 * for a library with books, already `completed` for an empty one. The check
 * and the insert run under a per-user advisory lock (held until the
 * transaction ends), so concurrent requests queue behind each other instead of
 * all seeing no active import and each starting one, duplicating the books.
 */
export async function reserveItemImport({
  userId,
  source,
  totalCount,
}: {
  userId: string;
  source: ImportSource;
  totalCount: number;
}): Promise<ReserveItemImportResult> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`item-import:${userId}`}, 0))`;

    const active = await tx.itemImport.findFirst({
      where: { userId, status: { in: [...ACTIVE_IMPORT_STATUSES] } },
      select: { id: true },
    });
    if (active) return { status: "in_progress", importId: active.id };

    const empty = totalCount === 0;
    const created = await tx.itemImport.create({
      data: {
        userId,
        source,
        totalCount,
        status: empty ? "completed" : "importing",
        completedAt: empty ? new Date() : null,
      },
      select: { id: true },
    });
    return { status: "created", importId: created.id };
  });
}
