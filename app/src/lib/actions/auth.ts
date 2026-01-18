"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPostHogClient } from "@/lib/posthog-server";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();

  // Get user ID before signing out for tracking
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  // Track logout event
  if (user) {
    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: user.id,
      event: "user_logged_out",
    });
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
