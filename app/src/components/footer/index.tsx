import { createClient, getUserWithMfa } from "@/lib/supabase/server";
import { FooterClient } from "./client";

export async function Footer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getUserWithMfa(supabase);

  return <FooterClient isAuthenticated={!!user} />;
}
