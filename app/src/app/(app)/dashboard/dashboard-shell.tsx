import type { ReactNode } from "react";

/**
 * The dashboard's frame: header above, page below. Shared by the dashboard
 * layout and the installed app's launch skeleton (`/~launch`), so a launch
 * lines up with the dashboard that replaces it.
 */
export function DashboardShell({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {header}
      <div className="flex w-full flex-1 flex-col overflow-hidden px-4 py-2">
        {children}
      </div>
    </div>
  );
}
