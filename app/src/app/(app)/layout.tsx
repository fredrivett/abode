import { redirect } from "next/navigation";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const dbUser = await db.user.findUnique({
    where: { id: data.claims.sub as string },
    select: { username: true },
  });

  if (!dbUser?.username) {
    redirect("/complete-signup");
  }

  return <>{children}</>;
}
