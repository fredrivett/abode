import { read } from "@/lib/db";

// The sitemap protocol's per-file URL limit
export const MAX_SITEMAP_URLS = 50_000;

type SitemapPath = { path: string; lastModified: Date };

/**
 * Profile and public-room paths for users who opted in to search indexing
 * (`allowSearchIndexing`). Mirrors `publicContentSeo` — only content that
 * page would mark indexable belongs here.
 */
export async function getIndexablePublicContentPaths({
  limit,
}: {
  limit: number;
}): Promise<SitemapPath[]> {
  const users = await read.user.findMany({
    where: { allowSearchIndexing: true, username: { not: null } },
    select: {
      username: true,
      updatedAt: true,
      rooms: {
        where: { visibility: "public", slug: { not: null } },
        select: { slug: true, updatedAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return users
    .flatMap(({ username, updatedAt, rooms }) => [
      { path: `/@${username}`, lastModified: updatedAt },
      ...rooms.map((room) => ({
        path: `/@${username}/${room.slug}`,
        lastModified: room.updatedAt,
      })),
    ])
    .slice(0, limit);
}
