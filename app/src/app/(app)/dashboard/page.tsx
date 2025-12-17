import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import type { ImageColor } from "@/lib/vision";
import { ItemsGrid } from "./items-grid";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [, { data: userData }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);

  const user = userData.user;

  const itemsForClient = user
    ? await db.item.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          processingStatus: true,
          fileKey: true,
          meta: true,
          sourceType: true,
          sourceUrl: true,
          coverFileKey: true,
          createdAt: true,
          title: true,
          description: true,
          tags: true,
          locations: {
            select: {
              id: true,
              source: true,
              latitude: true,
              longitude: true,
              neighborhood: true,
              city: true,
              region: true,
              country: true,
              countryCode: true,
              formatted: true,
            },
          },
          imageDetails: {
            select: {
              objects: true,
              colors: true,
              ocrText: true,
            },
          },
          articleDetails: {
            select: {
              author: true,
              domain: true,
              publishedAt: true,
              readingTime: true,
              content: true,
            },
          },
        },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <ItemsGrid
        items={itemsForClient.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          meta: (item.meta as Record<string, unknown> | null) ?? null,
          objects: item.imageDetails?.objects ?? [],
          colors: (item.imageDetails?.colors as ImageColor[]) ?? [],
          ocrText: item.imageDetails?.ocrText ?? null,
          imageDetails: undefined,
          articleDetails: item.articleDetails
            ? {
                ...item.articleDetails,
                publishedAt:
                  item.articleDetails.publishedAt?.toISOString() ?? null,
              }
            : null,
        }))}
      />
    </div>
  );
}
