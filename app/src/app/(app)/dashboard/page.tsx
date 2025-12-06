import { Button } from "@/components/ui/button";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { UploadWidget } from "./upload-widget";
import { UploadsList } from "./uploads-list";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ data: claims }, { data: userData }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);

  const user = userData.user;

  const itemsForClient =
    user
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Logged in as {claims?.claims?.email}
        </p>
      </div>

      <UploadWidget />

      <UploadsList
        items={itemsForClient.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          meta: (item.meta as Record<string, unknown> | null) ?? null,
        }))}
      />

      <form>
        <Button type="submit" formAction={signOut} variant="outline" size="lg">
          Sign out
        </Button>
      </form>
    </div>
  );
}
