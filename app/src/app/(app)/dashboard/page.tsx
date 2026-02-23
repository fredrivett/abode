import db from "@/lib/db";
import { itemSelect, transformItem } from "@/lib/items/query";
import { DEFAULT_PAGE_SIZE, encodeCursor } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { SearchableItemsGrid } from "./searchable-items-grid";

/**
 * Main dashboard page that server-renders the first page of the user's items.
 *
 * Passes initial data to `SearchableItemsGrid` for hydration.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const [, { data: userData }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);

  const user = userData.user;

  // Fetch only first page + 1 to check if there are more
  const fetchLimit = DEFAULT_PAGE_SIZE + 1;

  const [rawItems, total] = user
    ? await Promise.all([
        db.item.findMany({
          where: { userId: user.id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: fetchLimit,
          select: itemSelect,
        }),
        db.item.count({ where: { userId: user.id } }),
      ])
    : [[], 0];

  // Check if there are more results
  const hasMore = rawItems.length > DEFAULT_PAGE_SIZE;
  const pageItems = rawItems.slice(0, DEFAULT_PAGE_SIZE);

  // Generate cursor for next page
  let initialCursor: string | null = null;
  if (hasMore && pageItems.length > 0) {
    const lastItem = pageItems[pageItems.length - 1];
    initialCursor = encodeCursor({
      createdAt: lastItem.createdAt.toISOString(),
      id: lastItem.id,
    });
  }

  const itemsForClient = pageItems.map(transformItem);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <SearchableItemsGrid
        initialItems={itemsForClient}
        initialCursor={initialCursor}
        initialHasMore={hasMore}
        initialTotal={total}
      />
    </div>
  );
}
