"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = {
  error?: string;
  success?: boolean;
  message?: string;
  email?: string;
};

export async function signup(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    email,
    message: "Check your email for a confirmation code.",
  };
}

export async function verifyOtp(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const token = formData.get("token") as string;

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
