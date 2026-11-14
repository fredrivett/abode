import { redirect } from "next/navigation";
import { requireCompletedSignup } from "@/lib/auth/require-completed-signup";

export default async function SettingsPage() {
  await requireCompletedSignup();
  redirect("/settings/account");
}
