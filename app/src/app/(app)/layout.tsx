import { redirect } from "next/navigation";
import db from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

/**
 * Root layout for authenticated app routes.
 *
 * Verifies the user is authenticated and has completed signup (has a username).
 * Redirects to `/login` or `/complete-signup` as needed.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { username: true },
  });

  if (!dbUser?.username) {
    redirect("/complete-signup");
  }

  return <>{children}</>;
}
