import type { Metadata } from "next";
import db from "@/lib/db";
import { decodeHtmlEntities } from "@/lib/html-metadata";
import { getItemDisplayName } from "@/lib/items/item-display-name";
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
 * Validate the `?item` deep link into a single canonical (lowercase) UUID — the
 * only shape safe to hand to the UUID-typed id filter and to match the id the
 * client compares against. Anything else (missing, malformed, repeated) is
 * treated as no open item.
 */
function resolveOpenItemId(item: string | string[] | undefined): string | null {
  return typeof item === "string" && isCanonicalUuid(item)
    ? item.toLowerCase()
    : null;
}

function fetchOpenItem({ itemId, userId }: { itemId: string; userId: string }) {
  return db.item.findFirst({
    where: { id: itemId, userId },
    select: itemSelect,
  });
}

/**
 * Render the open item's name into the server `<title>` so a refresh / deep link
 * shows the right tab title with no flicker. The client (ItemDialogProvider)
 * keeps the title in sync for in-page open/close/rename; here we only need the
 * initial SSR value to match what the client sets, so a full-page load doesn't
 * briefly show the base title. `absolute` bypasses the root title template so
 * the value matches the client's exactly (no `[branch] ` dev prefix).
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ item?: string | string[] }>;
}): Promise<Metadata> {
  const { item } = await searchParams;
  const openItemId = resolveOpenItemId(item);
  if (!openItemId) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const openItemRaw = await fetchOpenItem({
    itemId: openItemId,
    userId: user.id,
  });
  if (!openItemRaw) return {};

  const name = decodeHtmlEntities(
    getItemDisplayName(transformItem(openItemRaw)),
  );
  return { title: { absolute: `${name} | abode` } };
}

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
  const openItemId = resolveOpenItemId(openItemParam);
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
          ? fetchOpenItem({ itemId: openItemId, userId: user.id })
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
