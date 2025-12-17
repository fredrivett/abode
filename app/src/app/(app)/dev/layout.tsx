import { notFound } from "next/navigation";

/**
 * Dev layout - only accessible in non-production environments.
 * All pages under /dev/* are blocked in production.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <>{children}</>;
}
