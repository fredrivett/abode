import type { DataExportStatus, Prisma } from "@prisma/client";

/** A data export as the settings page sees it (JSON-safe) */
export type DataExportSnapshot = {
  id: string;
  status: DataExportStatus;
  itemCount: number | null;
  fileCount: number | null;
  sizeBytes: number | null;
  /** Downloadable ZIP parts, in order (empty until completed, and after expiry) */
  parts: { position: number; sizeBytes: number }[];
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
};

export const dataExportSnapshotSelect = {
  id: true,
  status: true,
  itemCount: true,
  fileCount: true,
  sizeBytes: true,
  parts: {
    select: { position: true, sizeBytes: true },
    orderBy: { position: "asc" },
  },
  error: true,
  createdAt: true,
  completedAt: true,
  expiresAt: true,
} satisfies Prisma.DataExportSelect;

type DataExportSnapshotRow = Prisma.DataExportGetPayload<{
  select: typeof dataExportSnapshotSelect;
}>;

export function toDataExportSnapshot(
  row: DataExportSnapshotRow,
): DataExportSnapshot {
  return {
    ...row,
    sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
    parts: row.parts.map(({ position, sizeBytes }) => ({
      position,
      sizeBytes: Number(sizeBytes),
    })),
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

/** Whether an export is still being built (so the UI keeps polling) */
export function isExportInProgress(status: DataExportStatus): boolean {
  return status === "pending" || status === "exporting";
}

/** How many recent exports the settings page lists */
export const RECENT_EXPORTS_LIMIT = 5;
