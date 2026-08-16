import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TabInfo = { favicon: string; title: string };

const TABS: TabInfo[] = [
  { favicon: "/favicon-light.png", title: "abode" },
  { favicon: "/globe.svg", title: "How to Start a Startup" },
];

function Tab({ favicon, title, active }: TabInfo & { active: boolean }) {
  return (
    <div
      className={cn(
        "-mb-px flex h-14 min-w-0 max-w-96 items-center gap-3.5 rounded-t-xl px-6 text-lg transition-colors",
        // The active tab is opaque and shares the body's border, so it reads as
        // sitting in front of and connected to the window below.
        active
          ? "border border-border border-b-0 bg-background font-medium text-foreground"
          : "border border-transparent text-muted-foreground/70 hover:text-muted-foreground",
      )}
    >
      {/* biome-ignore lint/performance/noImgElement: tiny static favicon */}
      <img src={favicon} alt="" className="size-6 shrink-0 rounded-[6px]" />
      <span className="truncate">{title}</span>
    </div>
  );
}

/**
 * A minimal browser-window chrome (tab strip + rounded border) drawn around the
 * wall during the "save from anywhere" step. It's a decorative overlay that
 * never wraps/remounts the children (the grid) — so the fly-in refs and layout
 * stay intact — and fades in/out with `show`.
 */
export function BrowserChrome({
  show,
  activeTab = 0,
  children,
}: {
  show: boolean;
  /** Which tab's content is showing (0 = abode/grid, 1 = the essay). */
  activeTab?: number;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out",
          show ? "opacity-100" : "opacity-0",
        )}
      >
        {/* Window frame: hugs the grid box (its p-6 is the internal gutter) and
            extends above it for the tab strip. */}
        <div className="-top-16 absolute inset-x-0 bottom-0 flex flex-col">
          <div className="relative z-10 flex h-16 items-end gap-2 px-4 pl-8">
            {/* traffic lights */}
            <span className="mr-4 flex items-center gap-3 pb-4">
              <span className="size-4.5 rounded-full bg-muted-foreground/25" />
              <span className="size-4.5 rounded-full bg-muted-foreground/25" />
              <span className="size-4.5 rounded-full bg-muted-foreground/25" />
            </span>
            {TABS.map((tab, i) => (
              <Tab key={tab.title} {...tab} active={i === activeTab} />
            ))}
          </div>
          {/* Radius = card radius (rounded-2xl, 16px) + the grid's p-6 (24px),
              so the frame stays concentric with the items inside it. */}
          <div className="min-h-0 flex-1 rounded-[2.5rem] border border-border bg-background/60 shadow-2xl backdrop-blur-sm" />
        </div>
      </div>
      {children}
    </div>
  );
}
