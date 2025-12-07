import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { UploadsList } from "./uploads-list";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ data: claims }, { data: userData }] = await Promise.all([
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
          source: true,
          createdAt: true,
        },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <UploadsList
        items={itemsForClient.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          meta: (item.meta as Record<string, unknown> | null) ?? null,
        }))}
      />
    </div>
  );
}
