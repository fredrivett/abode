import { triggerRunUrl } from "@/lib/admin/trigger-dashboard";
import { listItemRuns } from "@/lib/trigger/item-runs";
import { type ItemRunRow, ItemRunsCard } from "./item-runs-card";

/**
 * Server component that fetches an item's recent Trigger runs (by `item_<id>`
 * tag) and renders them. Awaits an external API call, so the page wraps it in a
 * <Suspense> boundary to stream it in without blocking the rest of the inspector.
 */
export async function ItemRunsSection({ itemId }: { itemId: string }) {
  const result = await listItemRuns(itemId);

  if (result.state !== "ok") return <ItemRunsCard result={result} />;

  const runs: ItemRunRow[] = result.runs.map((run) => ({
    ...run,
    href: triggerRunUrl(run.id),
  }));

  return <ItemRunsCard result={{ state: "ok", runs }} />;
}
