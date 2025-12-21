import { Suspense } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<div className="h-16" />}>
        <DashboardHeader />
      </Suspense>
      {children}
    </>
  );
}
