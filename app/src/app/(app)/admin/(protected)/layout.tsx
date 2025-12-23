import { redirect } from "next/navigation";
import { checkAdminAccess } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const access = await checkAdminAccess(supabase);

  // Not logged in - middleware should have caught this, but just in case
  if (!access.userId) {
    redirect("/login");
  }

  // Not an admin - redirect to dashboard
  if (!access.isAdmin) {
    redirect("/dashboard");
  }

  // Admin without MFA set up - redirect to settings to set it up
  if (!access.hasMFA) {
    redirect("/settings?setup=mfa");
  }

  // Admin with MFA but not at aal2 - redirect to admin verify page
  if (!access.isAAL2) {
    redirect("/admin/verify");
  }

  // User is admin with MFA at aal2 - allow access
  return <>{children}</>;
}
