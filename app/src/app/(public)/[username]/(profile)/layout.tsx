import { Suspense } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";

export default function ProfileLayout({
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
