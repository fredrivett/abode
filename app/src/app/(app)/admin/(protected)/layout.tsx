import { requireAdmin } from "@/lib/admin/require-admin";

/**
 * Sends non-admins away from the admin section on navigation. It is not what
 * protects the pages: Next can render a page without this layout, so each
 * page awaits requireAdmin itself.
 */
export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return <>{children}</>;
}
