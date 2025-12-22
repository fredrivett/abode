import { createClient } from "@/lib/supabase/server";
import { FooterClient } from "./client";

export async function Footer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <FooterClient isAuthenticated={!!user} />;
}
