import { redirect } from "next/navigation";
import db from "@/lib/db";
import { getAuthUser } from "@/lib/supabase/server";
import type { ImportSnapshot } from "@/lib/use-import-poll";
import { ImportSettings } from "../_components/import-settings";

export default async function ImportSettingsPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }

  // Seed the UI only with an in-flight import (query the active row directly, so a
  // newer completed/failed row can't hide a still-running one), so progress
  // survives navigation; nothing active leaves a clean form.
  const active = await db.itemImport.findFirst({
    where: { userId: user.id, status: { in: ["pending", "importing"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      source: true,
      status: true,
      totalCount: true,
      importedCount: true,
      skippedCount: true,
      failedCount: true,
      error: true,
      createdAt: true,
      completedAt: true,
    },
  });

  const initialImport = active
    ? ({
        ...active,
        createdAt: active.createdAt.toISOString(),
        completedAt: active.completedAt?.toISOString() ?? null,
      } satisfies ImportSnapshot)
    : null;

  return (
    <div className="space-y-6">
      <ImportSettings initialImport={initialImport} />
    </div>
  );
}
