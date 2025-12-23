"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = {
  error?: string;
  success?: boolean;
};

export async function login(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data: authData, error } =
    await supabase.auth.signInWithPassword(data);

  if (error) {
    return { error: error.message };
  }

  // Log login activity (fire-and-forget)
  if (authData.user) {
    void logActivity(authData.user.id, "user_login");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
