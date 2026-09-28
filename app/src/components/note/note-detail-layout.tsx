import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The note detail view's frame: a scrolling, prose-width column at the
 * detail-view note size, plus an optional status footer. Shared by the note
 * editor view and its loading placeholder so the swap between them lines up.
 */
export function NoteDetailLayout({
  children,
  footer,
  className,
}: {
  children: ReactNode;
  /** Status row under the note (e.g. "Saving"); reserve it even when empty */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full w-full flex-col bg-background", className)}>
      <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12">
        {/* Full-screen editor: comfortable fixed size instead of the grid's
            density-scaled note prose */}
        <div className="mx-auto w-full max-w-prose [--note-prose-size:1rem] md:[--note-prose-size:1.0625rem]">
          {children}
        </div>
      </div>
      {footer !== undefined && (
        <div className="flex h-6 items-center justify-end px-6 pb-2 text-muted-foreground text-xs">
          {footer}
        </div>
      )}
    </div>
  );
}
