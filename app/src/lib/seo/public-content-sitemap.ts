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
  const optedIn = { allowSearchIndexing: true, username: { not: null } };

  // Both queries are capped in the database, so the sitemap's cost stays
  // bounded however much content is opted in. Profiles fill first
  const profiles = await read.user.findMany({
    where: optedIn,
    select: { username: true, updatedAt: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const rooms = await read.room.findMany({
    where: { visibility: "public", slug: { not: null }, user: optedIn },
    select: {
      slug: true,
      updatedAt: true,
      user: { select: { username: true } },
    },
    orderBy: { createdAt: "asc" },
    take: Math.max(limit - profiles.length, 0),
  });

  return [
    ...profiles.map(({ username, updatedAt }) => ({
      path: `/@${username}`,
      lastModified: updatedAt,
    })),
    ...rooms.map(({ slug, updatedAt, user }) => ({
      path: `/@${user.username}/${slug}`,
      lastModified: updatedAt,
    })),
  ];
}
