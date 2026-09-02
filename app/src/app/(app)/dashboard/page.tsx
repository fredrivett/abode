import db from "@/lib/db";
import { getNoteDraft } from "@/lib/items/note-draft";
import { itemSelect, transformItem } from "@/lib/items/query";
import {
  DEFAULT_PAGE_SIZE,
  encodeCursor,
  isCanonicalUuid,
} from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { SearchableItemsGrid } from "./searchable-items-grid";
import { ShareToast } from "./share-toast";

/**
 * Main dashboard page that server-renders the first page of the user's items.
 *
 * Passes initial data to `SearchableItemsGrid` for hydration.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ share?: string; item?: string | string[] }>;
}) {
  const { share, item: openItemParam } = await searchParams;
  // The open-item deep link must be a single canonical UUID before it reaches
  // the UUID-typed id filter — a malformed or repeated ?item would otherwise
  // 500 the dashboard. Lowercase it so an uppercase URL matches the canonical
  // (lowercase) id the client compares against. Anything else is no open item.
  const openItemId =
    typeof openItemParam === "string" && isCanonicalUuid(openItemParam)
      ? openItemParam.toLowerCase()
      : null;
  const supabase = await createClient();
  const [, { data: userData }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);

  const user = userData.user;

  // Fetch only first page + 1 to check if there are more
  const fetchLimit = DEFAULT_PAGE_SIZE + 1;

  const [rawItems, total, initialNoteDraft, openItemRaw] = user
    ? await Promise.all([
        db.item.findMany({
          where: { userId: user.id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: fetchLimit,
          select: itemSelect,
        }),
        db.item.count({ where: { userId: user.id } }),
        getNoteDraft(user.id),
        // Fetch the deep-linked/refreshed open item so its dialog reopens even
        // when it isn't on the first page of the grid
        openItemId
          ? db.item.findFirst({
              where: { id: openItemId, userId: user.id },
              select: itemSelect,
            })
          : Promise.resolve(null),
      ])
    : [[], 0, null, null];

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
  const initialOpenItem = openItemRaw ? transformItem(openItemRaw) : null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <ShareToast share={share} />
      <SearchableItemsGrid
        initialItems={itemsForClient}
        initialCursor={initialCursor}
        initialHasMore={hasMore}
        initialTotal={total}
        initialNoteDraft={initialNoteDraft}
        initialOpenItem={initialOpenItem}
      />
    </div>
  );
}
