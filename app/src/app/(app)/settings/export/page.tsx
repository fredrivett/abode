import { requireCompletedSignup } from "@/lib/auth/require-completed-signup";
import db from "@/lib/db";
import {
  dataExportSnapshotSelect,
  RECENT_EXPORTS_LIMIT,
  toDataExportSnapshot,
} from "@/lib/export/snapshot";
import { isTriggerConfigured } from "@/lib/trigger/item-runs";
import { ExportSettings } from "../_components/export-settings";

export default async function ExportSettingsPage() {
  const { user } = await requireCompletedSignup();

  const exports = await db.dataExport.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: RECENT_EXPORTS_LIMIT,
    select: dataExportSnapshotSelect,
  });

  return (
    <div className="space-y-6">
      <ExportSettings
        initialExports={exports.map(toDataExportSnapshot)}
        available={isTriggerConfigured()}
      />
    </div>
  );
}
