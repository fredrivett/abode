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

  // Seed the UI only with an in-flight import, so progress survives navigation;
  // a finished one leaves a clean form rather than a stale result box.
  const latest = await db.itemImport.findFirst({
    where: { userId: user.id },
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

  const active =
    latest && (latest.status === "importing" || latest.status === "pending")
      ? ({
          ...latest,
          createdAt: latest.createdAt.toISOString(),
          completedAt: latest.completedAt?.toISOString() ?? null,
        } satisfies ImportSnapshot)
      : null;

  return (
    <div className="space-y-6">
      <ImportSettings initialImport={active} />
    </div>
  );
}
