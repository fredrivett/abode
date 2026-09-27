import type { Metadata } from "next";
import { NO_INDEX_ROBOTS } from "@/lib/seo/indexing";

// Public ≠ searchable: shared profiles, rooms and items are reachable by link
// (with share cards) but stay out of search engines unless the owner opts in
export const metadata: Metadata = { robots: NO_INDEX_ROBOTS };

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
