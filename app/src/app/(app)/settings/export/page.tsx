import { redirect } from "next/navigation";
import { requireCompletedSignup } from "@/lib/auth/require-completed-signup";
import db from "@/lib/db";
import {
  dataExportSnapshotSelect,
  RECENT_EXPORTS_LIMIT,
  toDataExportSnapshot,
} from "@/lib/export/snapshot";
import { ROUTES } from "@/lib/routes";
import { getAuthUser } from "@/lib/supabase/server";
import { isTriggerConfigured } from "@/lib/trigger/item-runs";
import { ExportSettings } from "../_components/export-settings";

export default async function ExportSettingsPage() {
  await requireCompletedSignup();
  const user = await getAuthUser();
  if (!user) {
    redirect(ROUTES.LOGIN);
  }

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
